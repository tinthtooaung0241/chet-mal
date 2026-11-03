# Bake Quaternius UAL clips (CC0) to the game's joints, as turns in the character's frame.
import bpy, json, math
from mathutils import Quaternion
GLB="/Users/tinthtooaung/codespace/game/assets/vendor/quaternius-ual/x/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb"
OUT="/Users/tinthtooaung/codespace/game/client/src/game/clips.json"
CLIPS=["Idle_Loop","Walk_Loop","Jog_Fwd_Loop","Sitting_Idle_Loop"]
# game joint -> (UAL bone, parent game joint). Game "L" is the character's right.
MAP={"hips":("pelvis",None),"spine":("spine_02","hips"),"torso":("spine_03","spine"),"head":("Head","torso"),
"armL":("upperarm_r","torso"),"foreL":("lowerarm_r","armL"),"handL":("hand_r","foreL"),
"armR":("upperarm_l","torso"),"foreR":("lowerarm_l","armR"),"handR":("hand_l","foreR"),
"legL":("thigh_r","hips"),"shinL":("calf_r","legL"),"footL":("foot_r","shinL"),
"legR":("thigh_l","hips"),"shinR":("calf_l","legR"),"footR":("foot_l","shinR")}
# the game's rest pose has the T-pose arms lowered 68 degrees about Blender Y
LOWER={"R":Quaternion((0,1,0),math.radians(68)),"L":Quaternion((0,1,0),math.radians(-68))}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
arm=next(o for o in bpy.data.objects if o.type=="ARMATURE")
ad=arm.animation_data or arm.animation_data_create()
for t in list(ad.nla_tracks): ad.nla_tracks.remove(t)
acts={a.name:a for a in bpy.data.actions}
print("ACTS",list(acts)[:5])
def find(n): return next(a for k,a in acts.items() if k==n or k.startswith(n))
def use(n):
    a=find(n); ad.action=a
    if hasattr(ad,"action_slot") and len(a.slots): ad.action_slot=a.slots[0]
    return a
def sample(frame):
    bpy.context.scene.frame_set(frame); bpy.context.view_layer.update()
    w=arm.matrix_world.to_quaternion()
    return {j:(w@arm.pose.bones[b].matrix.to_quaternion()) for j,(b,_) in MAP.items()},(arm.matrix_world@arm.pose.bones["pelvis"].matrix.translation)
a=use("A_TPose"); T,Tp=sample(int(a.frame_range[0]))
out={}
for c in CLIPS:
    a=use(c); f0,f1=map(int,a.frame_range); bones={j:[] for j in MAP}; hip=[]
    for f in range(f0,f1):  # last frame repeats the first in a loop
        R,p=sample(f); D={}
        for j in MAP:
            d=R[j]@T[j].inverted()
            if j[:3] in("arm","for","han"): d=d@LOWER[j[-1]].inverted()
            D[j]=d
        for j,(_,par) in MAP.items():
            q=D[j] if par is None else D[par].inverted()@D[j]
            # Blender to glTF axes (the space the bones live in)
            bones[j]+= [round(v,3) for v in (q.x,q.z,-q.y,q.w)]
        hip.append(round((p.z-Tp.z)/Tp.z,3))
    out[c]={"fps":bpy.context.scene.render.fps,"frames":f1-f0,"hip":hip,"bones":bones}
    print("CLIP",c,f1-f0)
json.dump(out,open(OUT,"w"),separators=(",",":"))
print("OK",Tp.z,bpy.context.scene.render.fps,arm.matrix_world.to_euler())
