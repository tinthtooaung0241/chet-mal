// Voice chat between the three chefs: peer-to-peer WebRTC, signalled through the game server.
// It follows the roles: the mute chef sends no microphone, the deaf chef plays no voices, and
// every voice comes from where that chef is standing (3D audio), so a blind chef can tell
// who is where just by listening.
import { ROLES, findChef, type Chef, type Game, type Role } from "@kitchen/shared";

// STUN finds a direct route; phones on mobile data often need a TURN relay as well. Set
// VITE_TURN_URL (one or more, comma-separated), VITE_TURN_USERNAME and VITE_TURN_CREDENTIAL at
// build time to add one (Cloudflare Calls, Twilio, metered.ca or your own coturn).
const turn = import.meta.env.VITE_TURN_URL as string | undefined;
const ICE: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    ...(turn
      ? [{ urls: turn.split(",").map((u) => u.trim()), username: import.meta.env.VITE_TURN_USERNAME as string | undefined, credential: import.meta.env.VITE_TURN_CREDENTIAL as string | undefined }]
      : []),
  ],
};

type Signal = { sdp: RTCSessionDescriptionInit } | { candidate: RTCIceCandidateInit };

interface Peer {
  pc: RTCPeerConnection;
  /** Chrome only flows remote WebRTC audio into Web Audio if an element also holds the stream */
  sink?: HTMLAudioElement;
  panner?: PannerNode;
  gain?: GainNode;
}

export class Voice {
  private peers = new Map<string, Peer>();
  /** every teammate's voice goes through here (the Voices setting) */
  private master: GainNode | null = null;
  private volume = 1;

  /** 0 (off) to 1 (full). */
  setVolume(volume: number) {
    this.volume = volume;
    this.master?.gain.setTargetAtTime(volume, this.master.context.currentTime, 0.05);
  }

  private mic: MediaStream | null = null;
  private micOn = true;

  /** The Microphone setting: off keeps the call but sends silence. */
  setMicOn(on: boolean) {
    this.micOn = on;
    this.mic?.getAudioTracks().forEach((t) => (t.enabled = on));
  }

  private me = "";
  private hears = true;
  /** resolves once we know whether we have a microphone; calls wait for it so the mic joins them */
  private ready: Promise<void> = Promise.resolve();
  status = "off";

  constructor(
    private readonly signal: (to: string, data: Signal) => void,
    private readonly audio: () => AudioContext | null,
    private readonly report: (message: string) => void,
  ) {}

  /** Connect to everyone else in the kitchen. Lower id makes the offer, so offers never cross. */
  async start(me: string, role: Role, others: string[]) {
    this.stop();
    this.me = me;
    this.hears = ROLES[role].hears;
    const speaks = role !== "mute";
    this.ready = (async () => {
      if (!speaks) {
        this.status = "listening only";
        return;
      }
      this.status = "asking for microphone";
      try {
        this.mic = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        this.setMicOn(this.micOn);
        this.status = "on";
      } catch {
        this.status = "no microphone";
        this.report("Voice chat: no microphone access, so your teammates can't hear you. You can still hear them.");
      }
    })();
    await this.ready;
    for (const id of others) if (me < id) await this.offer(id);
  }

  stop() {
    for (const peer of this.peers.values()) this.close(peer);
    this.peers.clear();
    this.mic?.getTracks().forEach((t) => t.stop());
    this.mic = null;
  }

  private close(peer: Peer) {
    peer.pc.close();
    peer.sink?.remove();
    peer.panner?.disconnect();
  }

  private peer(id: string): Peer {
    let peer = this.peers.get(id);
    if (peer) return peer;
    const pc = new RTCPeerConnection(ICE);
    peer = { pc };
    this.peers.set(id, peer);
    if (this.mic) for (const track of this.mic.getTracks()) pc.addTrack(track, this.mic);
    else pc.addTransceiver("audio", { direction: "recvonly" });
    pc.onicecandidate = (e) => {
      if (e.candidate) this.signal(id, { candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => this.play(peer!, e.streams[0] ?? new MediaStream([e.track]));
    return peer;
  }

  private async offer(id: string) {
    const { pc } = this.peer(id);
    await pc.setLocalDescription(await pc.createOffer());
    this.signal(id, { sdp: pc.localDescription!.toJSON() });
  }

  async handle(from: string, data: Signal) {
    await this.ready;
    const { pc } = this.peer(from);
    try {
      if ("sdp" in data) {
        await pc.setRemoteDescription(data.sdp);
        if (data.sdp.type === "offer") {
          await pc.setLocalDescription(await pc.createAnswer());
          this.signal(from, { sdp: pc.localDescription!.toJSON() });
        }
      } else {
        await pc.addIceCandidate(data.candidate);
      }
    } catch (error) {
      console.warn("voice signalling failed", error);
    }
  }

  private play(peer: Peer, stream: MediaStream) {
    if (!this.hears || peer.panner) return; // a deaf chef plays no voices
    const ctx = this.audio();
    if (!ctx) return;
    peer.sink = new Audio();
    peer.sink.muted = true;
    peer.sink.srcObject = stream;
    void peer.sink.play().catch(() => {});
    const source = ctx.createMediaStreamSource(stream);
    peer.panner = new PannerNode(ctx, { panningModel: "HRTF", distanceModel: "inverse", refDistance: 1.5, rolloffFactor: 0.5 });
    peer.gain = new GainNode(ctx, { gain: 1 });
    if (!this.master) {
      this.master = new GainNode(ctx, { gain: this.volume });
      this.master.connect(ctx.destination);
    }
    source.connect(peer.gain).connect(peer.panner).connect(this.master);
  }

  /** A storm drowns voices out too: everyone has to fall back on what they can see. */
  setDucked(ducked: boolean) {
    const ctx = this.audio();
    if (!ctx) return;
    for (const peer of this.peers.values()) peer.gain?.gain.setTargetAtTime(ducked ? 0.08 : 1, ctx.currentTime, 0.3);
  }

  /** Place each teammate's voice where their chef stands, relative to my ears. */
  update(game: Game, me: Chef) {
    const ctx = this.audio();
    if (!ctx) return;
    for (const [id, peer] of this.peers) {
      const chef = findChef(game, id);
      if (!chef || !peer.panner) continue;
      const dx = chef.x - me.x;
      const dz = chef.z - me.z;
      const forward = dx * Math.sin(me.facing) + dz * Math.cos(me.facing);
      const right = dx * Math.cos(me.facing) - dz * Math.sin(me.facing);
      const t = ctx.currentTime;
      peer.panner.positionX.setTargetAtTime(right, t, 0.05);
      peer.panner.positionZ.setTargetAtTime(-forward, t, 0.05);
    }
  }

  get connected(): string[] {
    return [...this.peers.entries()].filter(([, p]) => p.pc.connectionState === "connected").map(([id]) => id);
  }

  get self(): string {
    return this.me;
  }
}
