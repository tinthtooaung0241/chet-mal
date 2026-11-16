// The shop, at the till or from the play menu: equipment upgrades, hats for your chef and decor
// for the terrace, each with what it does and a button with its price.
import { HATS, LOOK_COLORS, UPGRADES } from "@kitchen/shared";
import { buyUpgrade, loadBusiness } from "../business";
import { DECOR, buyDecor, ownedDecor } from "../decor";
import { buyHat, hasHat, myLook, wear } from "../looks";
import { $ } from "./dom";

export type ShopKind = "upgrade" | "hat" | "decor";

interface Row {
  name: string;
  blurb: string;
  /** the button: its words, whether it's the main action, and what it does (none: disabled) */
  button: { text: string; primary: boolean; act?: () => boolean };
  owned: boolean;
}

export class Shop {
  readonly dialog = $<HTMLDialogElement>("shop");

  /** @param onBought hears the name of each thing bought, and what kind of thing it is */
  constructor(private readonly onBought: (name: string, kind: ShopKind) => void) {
    $("close-shop").addEventListener("click", () => this.dialog.close());
  }

  /** Something here costs no more than the coins in the till. */
  affordable(): boolean {
    const { coins, upgrades } = loadBusiness();
    const decor = ownedDecor();
    return (
      UPGRADES.some((up) => !upgrades.includes(up.id) && up.cost <= coins) ||
      HATS.some((hat) => !hat.stickers && !hasHat(hat) && hat.cost <= coins) ||
      DECOR.some((d) => !decor.includes(d.id) && d.cost <= coins)
    );
  }

  open() {
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
  }

  private render() {
    const business = loadBusiness();
    const coins = business.coins;
    $("shop-coins").textContent = String(coins);
    const buy = (cost: number, name: string, kind: ShopKind, act: () => boolean) => ({
      text: `${cost} coins`,
      primary: true,
      act: coins >= cost ? () => (act() ? (this.onBought(name, kind), true) : false) : undefined,
    });

    this.list("shop-list", UPGRADES.map((up) => {
      const owned = business.upgrades.includes(up.id);
      return { name: up.name, blurb: up.blurb, owned, button: owned ? { text: "Owned", primary: false } : buy(up.cost, up.name, "upgrade", () => buyUpgrade(up.id)) };
    }));

    const look = myLook();
    this.list("hat-list", HATS.map((hat) => {
      const wearing = look.hat === hat.id;
      const got = hasHat(hat);
      const blurb = hat.stickers && !got ? `Collect ${hat.stickers} stickers to unlock it.` : hat.id === "none" ? "Just your chef." : "Everyone in the kitchen sees it.";
      const button = wearing
        ? { text: "Wearing", primary: false }
        : got
          ? { text: "Wear", primary: false, act: () => (wear({ ...look, hat: hat.id }), true) }
          : hat.stickers
            ? { text: `${hat.stickers} stickers`, primary: false }
            : buy(hat.cost, hat.name, "hat", () => buyHat(hat));
      return { name: hat.name, blurb, owned: wearing, button };
    }));
    $("hat-colors").replaceChildren(
      ...LOOK_COLORS.map((color) => {
        const swatch = document.createElement("button");
        swatch.type = "button";
        swatch.className = "swatch";
        swatch.style.background = color;
        swatch.setAttribute("role", "radio");
        swatch.setAttribute("aria-checked", String(color === look.color));
        swatch.setAttribute("aria-label", `Hat colour ${LOOK_COLORS.indexOf(color) + 1}`);
        swatch.addEventListener("click", () => {
          wear({ ...myLook(), color });
          this.render();
        });
        return swatch;
      }),
    );

    const decor = ownedDecor();
    this.list("decor-list", DECOR.map((d) => {
      const owned = decor.includes(d.id);
      return { name: d.name, blurb: d.blurb, owned, button: owned ? { text: "Owned", primary: false } : buy(d.cost, d.name, "decor", () => buyDecor(d)) };
    }));
  }

  private list(id: string, rows: Row[]) {
    $(id).replaceChildren(
      ...rows.map((row) => {
        const li = document.createElement("li");
        li.className = row.owned ? "owned" : "";
        const text = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = row.name;
        const blurb = document.createElement("span");
        blurb.textContent = row.blurb;
        text.append(name, blurb);
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = row.button.text;
        if (row.button.primary) button.className = "primary";
        button.disabled = !row.button.act;
        button.addEventListener("click", () => {
          row.button.act?.();
          this.render();
        });
        li.append(text, button);
        return li;
      }),
    );
  }
}
