// Burmese sentence patterns for the text the game builds from pieces: kitchen events, the coach,
// the action hints, toasts, the HUD and the lobby. Each English pattern matches one whole sentence
// (compound text is split into sentences first); captured pieces go through P() for nouns or tr()
// for anything else. Burmese puts the verb last and marks the object with ကို, so most patterns
// reorder the sentence rather than translate it word for word.
import type { Rule, Tools } from "../engine";

const rule = (pattern: RegExp, build: (m: RegExpMatchArray, t: Tools) => string | null): Rule => [pattern, build];

/** "hold F" or, on touch, "hold Use" (or "hold the Hold button", for players who turned it on) */
const HOLD = "([Hh]old F|[Hh]old the Hold button|[Hh]old Use)";
const hold = (en: string) => (/button/.test(en) ? "‘ဖိထား’ ခလုတ်ကို ဖိထား" : /Use/.test(en) ? "‘သုံး’ ကို ဖိထား" : "F ကို ဖိထား");

/** a chef's name, with the role in brackets translated: "Tint (head chef)" */
const ROLE_SUFFIX = / \((head chef|deaf chef|mute chef|all senses \(solo\))\)$/;
const nm = (name: string, t: Tools) => name.replace(ROLE_SUFFIX, (_, role: string) => ` (${t.P(role)})`);
/** "Table 3" */
const table = (s: string) => s.replace(/^Table (\d+)$/, "စားပွဲ $1");
/** "the fridge" / "the pantry": where a fridge or shelf item comes from, and goes back to */
const from = (where: string) => (/fridge/.test(where) ? "ရေခဲသေတ္တာထဲက" : "စင်ပေါ်က");
const into = (where: string) => (/fridge|crate/.test(where) ? "ရေခဲသေတ္တာထဲ" : "စင်ပေါ်");
const pay = (how: string) => (/card/i.test(how) ? "ကတ်" : "ငွေသား");
const vessel = (type: string, t: Tools) => t.P(type);

const SPECIFIC: Rule[] = [
  // ======================================================================== the shift
  rule(/^Time's up! You served (\d+) dishes(?:, (\d+) of them perfect)?, and scored (\d+) points\.(?: Overtime added (\d+)\.)?$/, (m) =>
    `အချိန်ပြည့်ပြီ! ဟင်း ${m[1]} ပွဲ ချခဲ့ပြီး${m[2] ? ` (အကောင်းဆုံး ${m[2]} ပွဲ)` : ""} အမှတ် ${m[3]} ရခဲ့တယ်။${m[4] ? ` အချိန်ပိုက ${m[4]} မှတ် ထပ်ရခဲ့တယ်။` : ""}`),
  rule(/^You served (\d+) dishes(?:, (\d+) of them perfect)?, and scored (\d+) points\.$/, (m) =>
    `ဟင်း ${m[1]} ပွဲ ချခဲ့ပြီး${m[2] ? ` (အကောင်းဆုံး ${m[2]} ပွဲ)` : ""} အမှတ် ${m[3]} ရခဲ့တယ်။`),
  rule(/^Overtime added (-?\d+)\.$/, (m) => `အချိန်ပိုက ${m[1]} မှတ် ထပ်ရခဲ့တယ်။`),
  rule(/^Overtime added (-?\d+) points\.$/, (m) => `အချိန်ပိုက အမှတ် ${m[1]} ထပ်ရခဲ့တယ်။`),
  rule(/^Three stars!$/, () => "ကြယ် သုံးပွင့်!"),
  rule(/^Overtime: keep cooking until a customer gives up\.$/, () => "အချိန်ပို: ဧည့်သည်တစ်ယောက် စိတ်ကုန်ပြီး မပြန်မချင်း ဆက်ချက်ပါ။"),
  rule(/^It only gets busier!$/, () => "ပိုပိုပြီး အလုပ်ရှုပ်လာမယ်!"),
  rule(/^Rush hour!$/, () => "လူစည်ချိန်!"),
  rule(/^Orders come twice as fast for (\d+) seconds, and every dish pays 50% more\.$/, (m) =>
    `${m[1]} စက္ကန့်အတွင်း အော်ဒါတွေ နှစ်ဆ မြန်မြန် ဝင်လာပြီး ဟင်းပွဲတိုင်း 50% ပိုရမယ်။`),
  rule(/^Rush hour is over\.$/, () => "လူစည်ချိန် ပြီးပြီ။"),
  rule(/^Breathe!$/, () => "အသက် ဝဝ ရှူလိုက်ဦး!"),
  rule(/^The power cuts out!$/, () => "မီးပျက်သွားပြီ!"),
  rule(/^The kitchen is pitch dark\.$/, () => "မီးဖိုချောင် မှောင်မည်းနေပြီ။"),
  rule(/^Talk each other through it\.$/, () => "အချင်းချင်း ပြောပြီး ကူညီကြပါ။"),
  rule(/^A storm hits!$/, () => "မုန်တိုင်း ဝင်လာပြီ!"),
  rule(/^Thunder drowns out every sound\.$/, () => "မိုးခြိမ်းသံကြောင့် ဘာသံမှ မကြားရတော့ဘူး။"),
  rule(/^Watch your deaf chef\.$/, () => "နားမကြားတဲ့ စားဖိုမှူးကို ကြည့်ပြီး လုပ်ပါ။"),
  rule(/^The lights flicker back on\.$/, () => "မီးတွေ ပြန်လာပြီ။"),
  rule(/^The storm passes\.$/, () => "မုန်တိုင်း ကုန်သွားပြီ။"),
  rule(/^You can hear again\.$/, () => "ပြန်ကြားရပြီ။"),
  rule(/^Minus (\d+) points\.$/, (m) => `အမှတ် ${m[1]} လျော့သွားတယ်။`),
  rule(/^Plus (\d+) points\.$/, (m) => `အမှတ် +${m[1]}။`),

  // ======================================================================== orders and customers
  rule(/^New ticket: (.+?)(, kid's, no seasoning)?\.$/, (m, t) => `အော်ဒါ အသစ်: ${t.P(m[1])}${m[2] ? " (ကလေးအတွက် — ဟင်းမခတ်ရ)" : ""}။`),
  rule(/^Phone order: "Hi! One (.+?) please\. That's (.+?)\.( It's for my kid, so no seasoning at all, please!)?"$/, (m, t) =>
    `ဖုန်းအော်ဒါ: "မင်္ဂလာပါ! ${t.P(m[1])} တစ်ပွဲ ပေးပါ။ ${t.P(m[2])} ပါတာနော်။${m[3] ? " ကလေးအတွက်မို့ ဟင်းလုံးဝ မခတ်ပါနဲ့နော်!" : ""}"`),
  // the caller's line, read aloud on its own
  rule(/^"Hi! One (.+?) please\. That's (.+?)\.( It's for my kid, so no seasoning at all, please!)?"$/, (m, t) =>
    `"မင်္ဂလာပါ! ${t.P(m[1])} တစ်ပွဲ ပေးပါ။ ${t.P(m[2])} ပါတာနော်။${m[3] ? " ကလေးအတွက်မို့ ဟင်းလုံးဝ မခတ်ပါနဲ့နော်!" : ""}"`),
  rule(/^A food critic just walked in(?:, for (Table \d+))?\.$/, (m) =>
    `အစားအသောက် ဝေဖန်ရေးဆရာ ရောက်လာပြီ${m[1] ? ` (${table(m[1])})` : ""}။`),
  rule(/^Be quick, and season it just right!$/, () => "မြန်မြန်လုပ်ပြီး ဟင်းခတ် အနေတော် ဖြစ်ပါစေ!"),
  rule(/^The (.+) ticket is running out of time\.$/, (m, t) => `${t.P(m[1])} အော်ဒါ အချိန်ကုန်တော့မယ်။`),
  rule(/^The phone customer sighs: "Where's my (.+)\?"$/, (m, t) => `ဖုန်းမှာထားတဲ့ ဧည့်သည် သက်ပြင်းချတယ်: "${t.P(m[1])} ဘယ်ရောက်နေပြီလဲ?"`),
  rule(/^The food critic walked out on their (.+)!$/, (m, t) => `ဝေဖန်ရေးဆရာက ${t.P(m[1])} မစောင့်တော့ဘဲ ထွက်သွားပြီ!`),
  rule(/^A bad review: minus (\d+) points\.$/, (m) => `သုံးသပ်ချက် မကောင်းဘူး — အမှတ် ${m[1]} လျော့သွားတယ်။`),
  rule(/^A customer gave up on their (.+)\.$/, (m, t) => `ဧည့်သည်တစ်ယောက် ${t.P(m[1])} မစောင့်တော့ဘဲ ပြန်သွားပြီ။`),
  rule(/^(Table \d+) is at the till to pay by (\w+)(?:, and left their dirty (plate|bowl) on the (dirty dish counter|pass))?\.$/, (m, t) =>
    `${table(m[1])} က ${pay(m[2])}နဲ့ ရှင်းဖို့ ငွေရှင်းကောင်တာမှာ စောင့်နေတယ်${m[3] ? `၊ ${t.P(`dirty ${m[3]}`)}ကို ${t.P(m[4])}ပေါ် ထားခဲ့တယ်` : ""}။`),
  rule(/^(Table \d+) got tired of waiting at the till and left without paying\.$/, (m) =>
    `${table(m[1])} က ငွေရှင်းကောင်တာမှာ စောင့်ရတာ ငြီးငွေ့ပြီး ငွေမရှင်းဘဲ ပြန်သွားပြီ။`),
  rule(/^(Table \d+) wants to pay by (\w+), not (\w+)\.$/, (m) => `${table(m[1])} က ${pay(m[3])} မဟုတ်ဘဲ ${pay(m[2])}နဲ့ ရှင်းချင်တယ်။`),
  rule(/^(Table \d+) paid (\d+) coins by (\w+)\.$/, (m) => `${table(m[1])} က ${pay(m[3])}နဲ့ ဒင်္ဂါး ${m[2]} ရှင်းသွားပြီ။`),
  rule(/^Thank you!$/, () => "ကျေးဇူးတင်ပါတယ်!"),
  rule(/^Nobody is waiting to pay\.$/, () => "ငွေရှင်းဖို့ စောင့်နေတဲ့သူ မရှိဘူး။"),
  rule(/^Table (\d+)$/, (m) => `စားပွဲ ${m[1]}`),
  rule(/^The kid at Table (\d+) needs a booster seat: put one on the pass \(empty hands\)$/, (m) =>
    `စားပွဲ ${m[1]} က ကလေး ထိုင်ခုံ လိုတယ်: ဟင်းထုတ်ကောင်တာပေါ် ကလေးထိုင်ခုံ တင်ပေးပါ (လက်အလွတ်နဲ့)`),
  rule(/^Booster seat out for the kid at Table (\d+)\.$/, (m) => `စားပွဲ ${m[1]} က ကလေးအတွက် ကလေးထိုင်ခုံ ထုတ်ပေးလိုက်ပြီ။`),
  rule(/^The head chef hands out booster seats\.?$/, () => "ကလေးထိုင်ခုံကို စားဖိုမှူးချုပ်က ပေးတယ်"),
  rule(/^Thank you for waiting!$/, () => "စောင့်ပေးတဲ့အတွက် ကျေးဇူးပါ!"),

  // ======================================================================== serving and scoring
  rule(/^Served (.+?)!$/, (m, t) => `${t.P(m[1])} ပွဲချပြီးပြီ!`),
  rule(/^Perfect (.+)!$/, (m, t) => `${t.P(m[1])} အကောင်းဆုံး!`),
  rule(/^A picture-perfect plate!$/, () => "ပုံထဲကလို လှတဲ့ ပွဲ!"),
  rule(/^Beautifully presented!$/, () => "လှလှပပ ပြင်ထားတယ်!"),
  rule(/^Seasoned just right!$/, () => "ဟင်းခတ် အနေတော်ပဲ!"),
  rule(/^Seasoned just right, with a perfect pinch!$/, () => "ဟင်းခတ် အနေတော်ပဲ — အကောင်းဆုံး ခတ်ထားတယ်!"),
  rule(/^Seasoned just right, (\d+) perfect pinches!$/, (m) => `ဟင်းခတ် အနေတော်ပဲ — ${m[1]} ခါ အကောင်းဆုံး ခတ်ထားတယ်!`),
  // what the seasoning was missing, one or two notes: "Too much salt on the steak; the potato needed salt."
  rule(/^(?=.*; )(.+)([.…])$/, (m, t) => {
    const notes = m[1].split("; ");
    if (!notes.every((n) => NOTE.test(n))) return null;
    return `${notes.map((note) => t.tr(note)).join("၊ ")}${m[2] === "…" ? "…" : "။"}`;
  }),
  rule(/^too much ([^;]+) on the ([^;]+?)\.?$/i, (m, t) => `${t.P(m[2])}မှာ ${t.P(m[1])} များသွားတယ်`),
  rule(/^the ([^;]+) needed ([^;]+?)\.?$/i, (m, t) => `${t.P(m[1])}မှာ ${t.P(m[2])} လိုတယ်`),
  rule(/^no ([^;]+) on the ([^;]+?)\.?$/i, (m, t) => `${t.P(m[2])}မှာ ${t.P(m[1])} မထည့်ရဘူး`),
  rule(/^([^;]+) goe?s? on the ([^;]+) (before|after) cooking\.?$/i, (m, t) =>
    `${t.P(m[1])}ကို ${t.P(m[2])}မှာ ${m[3] === "before" ? "မချက်ခင်" : "ချက်ပြီးမှ"} ခတ်ရမယ်`),
  rule(/^too much ([^;]+) on top\.?$/i, (m, t) => `အပေါ်မှာ ${t.P(m[1])} များသွားတယ်`),
  rule(/^it needed ([^;]+) to finish\.?$/i, (m, t) => `အဆုံးသတ်မှာ ${t.P(m[1])} လိုတယ်`),
  rule(/^they didn't want ([^;]+) on top\.?$/i, (m, t) => `အပေါ်မှာ ${t.P(m[1])} မလိုချင်ဘူး`),
  rule(/^A rave review!$/, () => "အကောင်းဆုံး သုံးသပ်ချက်!"),
  rule(/^The critic loved their (.+): plus (\d+) points, and they'll pay double at the till\.$/, (m, t) =>
    `ဝေဖန်ရေးဆရာက ${t.P(m[1])}ကို အရမ်းကြိုက်တယ်: အမှတ် +${m[2]}၊ ငွေရှင်းရင်လည်း နှစ်ဆ ပေးမယ်။`),
  rule(/^The critic's verdict: "(The seasoning was off|Tasty, but slow)\."$/, (m) =>
    `ဝေဖန်ရေးဆရာရဲ့ အမြင်: "${m[1] === "Tasty, but slow" ? "စားကောင်းပေမဲ့ နှေးတယ်" : "ဟင်းခတ် မမှန်ဘူး"}။"`),
  rule(/^No rave review this time\.$/, () => "ဒီတစ်ခါ အကောင်းဆုံး သုံးသပ်ချက် မရဘူး။"),
  rule(/^Combo ×(\d+)!$/, (m) => `ဆက်တိုက် ×${m[1]}!`),
  rule(/^Plus (\d+) bonus points\.$/, (m) => `ဆုအမှတ် +${m[1]}။`),
  rule(/^Serve the next dish within (\d+) seconds to keep it going\.$/, (m) => `ဆက်ဖြစ်နေအောင် ${m[1]} စက္ကန့်အတွင်း နောက်တစ်ပွဲ ချပါ။`),
  rule(/^Nobody ordered (.+)\.$/, (m, t) => `${t.P(m[1])}ကို ဘယ်သူမှ မမှာထားဘူး။`),
  rule(/^The dish was wasted(: take the dirty plate to the sink)?\.$/, (m) =>
    `ဟင်းပွဲ အလဟဿ ဖြစ်သွားပြီ${m[1] ? " — ပန်းကန်ပြားညစ်ကို ဘေစင်ဆီ ယူသွားပါ" : ""}။`),
  rule(/^A customer got sick from spoiled (.+)!$/, (m, t) => `ဧည့်သည်တစ်ယောက် ပုပ်နေတဲ့ ${t.P(m[1])} စားမိလို့ နေမကောင်း ဖြစ်သွားပြီ!`),

  // ======================================================================== cooking
  rule(/^The (.+?) (?:is|are) cooked\.$/, (m, t) => `${t.P(m[1])} ကျက်ပြီ။`),
  rule(/^Take (?:it|them) off the stove!$/, () => "မီးဖိုပေါ်က ချလိုက်ပါ!"),
  rule(/^The (.+?)(?:'s|') sizzle peaks\.$/, (m, t) => `${t.P(m[1])} ဆီပွက်သံ အမြင့်ဆုံး ရောက်ပြီ။`),
  rule(/^The (.+) shimmers golden\.$/, (m, t) => `${t.P(m[1])} ရွှေရောင် တောက်လာပြီ။`),
  rule(/^Take (?:it|them) off now for a perfect dish!$/, () => "အခု ချလိုက်ရင် အကောင်းဆုံး ဟင်းပွဲ ရမယ်!"),
  rule(/^The (.+?) (?:is|are) smoking\.$/, (m, t) => `${t.P(m[1])} မီးခိုးထွက်နေပြီ။`),
  rule(/^(?:It's|They're) about to burn!$/, () => "တူးတော့မယ်!"),
  rule(/^The (.+) burnt to the bottom of the pot\.$/, (m, t) => `${t.P(m[1])} အိုးကပ်ပြီး တူးသွားပြီ။`),
  rule(/^The (.+) burnt\.$/, (m, t) => `${t.P(m[1])} တူးသွားပြီ။`),
  rule(/^The (.+) is ready\.$/, (m, t) => `${t.P(m[1])} အဆင်သင့် ဖြစ်ပြီ။`),
  rule(/^Ladle it into a bowl!$/, () => "ပန်းကန်လုံးထဲ ခပ်ထည့်ပါ!"),
  rule(/^The (.+) bubbles just right\.$/, (m, t) => `${t.P(m[1])} အနေတော် ဆူနေပြီ။`),
  rule(/^Ladle it now for a perfect bowl!$/, () => "အခု ခပ်ရင် အကောင်းဆုံး တစ်ပန်းကန် ရမယ်!"),
  rule(/^The (.+) is boiling dry!$/, (m, t) => `${t.P(m[1])} ရေခန်းတော့မယ်!`),
  rule(/^(.+) is ready\.$/, (m, t) => `${t.P(m[1])} အဆင်သင့် ဖြစ်ပြီ။`),
  rule(/^The (.+) is ruined\.$/, (m, t) => `${t.P(m[1])} ပျက်သွားပြီ။`),
  rule(/^Throw it in the bin\.$/, () => "အမှိုက်ပုံးထဲ ပစ်လိုက်ပါ။"),
  rule(/^Chop the (.+) before cooking it\.$/, (m, t) => `မချက်ခင် ${t.P(m[1])}ကို အရင် လှီးပါ။`),
  rule(/^(.+) can't go on the stove\.$/, (m, t) => `${t.P(m[1])}ကို မီးဖိုပေါ် တင်လို့ မရဘူး။`),
  rule(/^Cooking…$/, () => "ချက်နေတယ်…"),
  rule(/^Put (.+) on the (.+?)\.$/, (m, t) => `${t.P(m[1])}ကို ${t.P(m[2])}ပေါ် တင်လိုက်ပြီ။`),
  rule(/^(Plates|Bowls) don't go on the stove\.$/, (m, t) => `${t.P(m[1])}ကို မီးဖိုပေါ် မတင်ရဘူး။`),
  rule(/^(Plates|Bowls) go on a counter, not the cutting board\.$/, (m, t) => `${t.P(m[1])}ကို စဉ်းတီတုံးပေါ် မဟုတ်ဘဲ ကောင်တာပေါ် တင်ပါ။`),
  rule(/^Food goes on a plate; bowls are for soup from the pot\.$/, () => "အစားအစာကို ပန်းကန်ပြားပေါ် တင်ပါ — ပန်းကန်လုံးက အိုးထဲက စွပ်ပြုတ်အတွက်ပါ။"),
  rule(/^The (.+?) already has (.+)\.$/, (m, t) => `${t.P(m[1])}ပေါ်မှာ ${t.P(m[2])} ရှိပြီးသား။`),
  rule(/^The (.+) is empty\.$/, (m, t) => `${t.P(m[1])}ပေါ်မှာ ဘာမှ မရှိဘူး။`),
  rule(/^Picked up (.+)\.$/, (m, t) => `${t.P(m[1])} ကောက်ယူလိုက်ပြီ။`),
  rule(/^Put (.+) on your tray: two dishes in one trip\.$/, (m, t) => `${t.P(m[1])}ကို ဗန်းပေါ် တင်လိုက်ပြီ — တစ်ခေါက်တည်းနဲ့ ဟင်းနှစ်ပွဲ။`),

  // chopping
  rule(/^The head chef doesn't chop\.$/, () => "စားဖိုမှူးချုပ်က မလှီးဘူး။"),
  rule(/^Ask a cook to\.$/, () => "စားဖိုမှူးတစ်ယောက်ကို ခိုင်းပါ။"),
  rule(/^Face a cutting board to chop\.$/, () => "လှီးဖို့ စဉ်းတီတုံးဘက် လှည့်ပါ။"),
  rule(/^Put down what you're holding to chop\.$/, () => "လှီးဖို့ ကိုင်ထားတာကို ချထားပါ။"),
  rule(/^Put an ingredient on the board first\.$/, () => "စဉ်းတီတုံးပေါ် ဟင်းချက်ပစ္စည်း အရင်တင်ပါ။"),
  rule(/^You can't chop that\.$/, () => "အဲဒါ လှီးလို့ မရဘူး။"),
  rule(/^The (.+) is already done\.$/, (m, t) => `${t.P(m[1])} ပြီးပြီးသားပါ။`),
  rule(/^(.+) doesn't need chopping\.$/, (m, t) => `${t.P(m[1])} လှီးစရာ မလိုဘူး။`),

  // the soup pot
  rule(/^The soup burnt\.$/, () => "စွပ်ပြုတ် တူးသွားပြီ။"),
  rule(/^Empty-handed, scrape it out first\.$/, () => "လက်အလွတ်နဲ့ အရင် ခြစ်ထုတ်ပါ။"),
  rule(/^You scrape the burnt soup out of the pot\.$/, () => "အိုးထဲက တူးသွားတဲ့ စွပ်ပြုတ်ကို ခြစ်ထုတ်လိုက်ပြီ။"),
  rule(/^The soup pot has (.+)\.$/, (m, t) => `စွပ်ပြုတ်အိုးထဲမှာ ${t.P(m[1])} ရှိတယ်။`),
  rule(/^The pot is already full\.$/, () => "အိုး ပြည့်နေပြီ။"),
  rule(/^(.+) doesn't go in soup\.$/, (m, t) => `${t.P(m[1])}ကို စွပ်ပြုတ်ထဲ မထည့်ရဘူး။`),
  rule(/^Chop the (.+) before it goes in the pot\.$/, (m, t) => `အိုးထဲ မထည့်ခင် ${t.P(m[1])}ကို အရင် လှီးပါ။`),
  rule(/^The (.+) goes in (raw|chopped)\.$/, (m, t) => `${t.P(m[1])}ကို ${m[2] === "raw" ? "ဒီအတိုင်း" : "လှီးပြီးမှ"} ထည့်ရမယ်။`),
  rule(/^Added (.+) to the pot \((\d+) of (\d+)\)\.$/, (m, t) => `${t.P(m[1])}ကို အိုးထဲ ထည့်ပြီးပြီ (${m[3]} ခုမှာ ${m[2]} ခု)။`),
  rule(/^Added (.+)\.$/, (m, t) => `${t.P(m[1])} ထည့်ပြီးပြီ။`),
  rule(/^The pot is full and starts to boil\.$/, () => "အိုးပြည့်ပြီး ဆူလာပြီ။"),
  rule(/^Soup goes in a bowl, not on a plate\.$/, () => "စွပ်ပြုတ်ကို ပန်းကန်ပြားမှာ မဟုတ်ဘဲ ပန်းကန်လုံးထဲ ထည့်ရမယ်။"),
  rule(/^That (plate|bowl)'s dirty: wash it at the sink first\.$/, (m, t) => `အဲဒီ ${t.P(m[1])} ညစ်နေတယ်: ဘေစင်မှာ အရင် ဆေးပါ။`),
  rule(/^That bowl is already full\.$/, () => "အဲဒီ ပန်းကန်လုံး ပြည့်နေပြီ။"),
  rule(/^The soup is still boiling\.$/, () => "စွပ်ပြုတ် ဆူနေတုန်းပဲ။"),
  rule(/^The pot needs (\d+) more chopped vegetables\.$/, (m) => `အိုးထဲကို ဟင်းသီးဟင်းရွက်လှီး ${m[1]} ခု ထပ်လိုသေးတယ်။`),
  rule(/^Ladled (.+) into the bowl\.$/, (m, t) => `${t.P(m[1])}ကို ပန်းကန်လုံးထဲ ခပ်ထည့်ပြီးပြီ။`),

  // plates, bowls, the bin, the pass, the sink
  rule(/^The plate is full\.$/, () => "ပန်းကန်ပြား ပြည့်နေပြီ။"),
  rule(/^Added (.+) to the plate\.$/, (m, t) => `${t.P(m[1])}ကို ပန်းကန်ပြားထဲ ထည့်ပြီးပြီ။`),
  rule(/^No clean (plates|bowls)!$/, (m, t) => `${t.P(m[1])} သန့်သန့် မရှိတော့ဘူး!`),
  rule(/^Wash some at the sink\.$/, () => "ဘေစင်မှာ ဆေးလိုက်ပါ။"),
  rule(/^Took a clean (plate|bowl)\.$/, (m, t) => `${t.P(m[1])} သန့်သန့် ယူလိုက်ပြီ။`),
  rule(/^Put the (plate|bowl) back\.$/, (m, t) => `${t.P(m[1])}ကို ပြန်ထားလိုက်ပြီ။`),
  rule(/^Plated (.+)\.$/, (m, t) => `${t.P(m[1])}ကို ပန်းကန်ပြားထဲ ထည့်ပြီးပြီ။`),
  rule(/^You have nothing to throw away\.$/, () => "လွှင့်ပစ်စရာ ဘာမှ မရှိဘူး။"),
  rule(/^The (plate|bowl) is already empty\.$/, (m, t) => `${t.P(m[1])} အလွတ်ပဲ ရှိသေးတယ်။`),
  rule(/^Emptied the plate into the bin\.$/, () => "ပန်းကန်ပြားကို အမှိုက်ပုံးထဲ သွန်လိုက်ပြီ။"),
  rule(/^Poured the soup away\.$/, () => "စွပ်ပြုတ်ကို သွန်ပစ်လိုက်ပြီ။"),
  rule(/^Threw away the (.+)\.$/, (m, t) => `${t.P(m[1])}ကို လွှင့်ပစ်လိုက်ပြီ။`),
  rule(/^Bring a plated dish or a bowl of soup here to serve it\.$/, () => "ပွဲချဖို့ ပန်းကန်ထဲ ထည့်ပြီးသား ဟင်း ဒါမှမဟုတ် စွပ်ပြုတ် တစ်ပန်းကန် ဒီကို ယူလာပါ။"),
  rule(/^Put it on a plate first\.$/, () => "ပန်းကန်ပြားပေါ် အရင် တင်ပါ။"),
  rule(/^The (plate|bowl) is empty\.$/, (m, t) => `${t.P(m[1])} အလွတ်ပဲ။`),
  rule(/^Fill it at the soup pot\.$/, () => "စွပ်ပြုတ်အိုးမှာ ခပ်ထည့်ပါ။"),
  rule(/^Put the dirty (plate|bowl) in the sink\.$/, (m, t) => `${t.P(`dirty ${m[1]}`)}ကို ဘေစင်ထဲ ထည့်လိုက်ပြီ။`),
  rule(new RegExp(`^${HOLD} to wash it\\.$`), (m) => `ဆေးဖို့ ${hold(m[1])}ပါ။`),
  rule(new RegExp(`^${HOLD} to wash the dishes\\.$`), (m) => `ပန်းကန်ဆေးဖို့ ${hold(m[1])}ပါ။`),
  rule(/^No washing up in this kitchen: there are plenty of clean plates\.$/, () => "ဒီမီးဖိုချောင်မှာ ပန်းကန်ဆေးစရာ မလိုဘူး — ပန်းကန်ပြား သန့်သန့် အများကြီး ရှိတယ်။"),
  rule(/^Nothing to wash yet\.$/, () => "ဆေးစရာ မရှိသေးဘူး။"),
  rule(/^Washed a (plate|bowl)\.$/, (m, t) => `${t.P(m[1])} တစ်ခု ဆေးပြီးပြီ။`),
  rule(/^(\d+) still to wash\.$/, (m) => `ဆေးစရာ ${m[1]} ခု ကျန်သေးတယ်။`),
  rule(/^All clean!$/, () => "အကုန် သန့်ပြီ!"),
  rule(/^No dirty dishes here yet\.$/, () => "ပန်းကန်ညစ် မရှိသေးဘူး။"),
  rule(/^Customers leave them here after eating\.$/, () => "ဧည့်သည်တွေ စားပြီးရင် ဒီမှာ ထားခဲ့တယ်။"),
  rule(/^Took a dirty (plate|bowl)\.$/, (m, t) => `${t.P(`dirty ${m[1]}`)} ယူလိုက်ပြီ။`),
  rule(/^Take it to the sink\.$/, () => "ဘေစင်ဆီ ယူသွားပါ။"),
  rule(/^Put the dirty (plate|bowl) back on the pile\.$/, (m, t) => `${t.P(`dirty ${m[1]}`)}ကို အပုံပေါ် ပြန်တင်လိုက်ပြီ။`),
  rule(/^This counter is for dirty dishes\.$/, () => "ဒီကောင်တာက ပန်းကန်ညစ်အတွက်ပါ။"),

  // fridges, shelves, crates
  rule(/^Took (?:a |an |the )?(.+?) from (the fridge|the pantry)\.$/, (m, t) => `${from(m[2])} ${t.P(m[1])} ယူလိုက်ပြီ။`),
  rule(/^Took a raw (.+)\.$/, (m, t) => `${t.P(m[1])} ယူလိုက်ပြီ။`),
  rule(/^Put the (.+?) back in (the fridge|the pantry|the crate|the fridge)\.$/, (m, t) => `${t.P(m[1])}ကို ${into(m[2])} ပြန်ထည့်လိုက်ပြီ။`),
  rule(/^Put the (.+?) back in the (\w+)\.$/, (m, t) => `${t.P(m[1])}ကို ${into(m[2])} ပြန်ထည့်လိုက်ပြီ။`),
  rule(/^The (.+) doesn't go in (the fridge|the pantry)\.$/, (m, t) => `${t.P(m[1])}ကို ${into(m[2])} ထည့်လို့ မရဘူး။`),
  rule(/^Your hands are full\.$/, () => "လက်မအားဘူး။"),
  rule(/^Your hands are empty\.$/, () => "လက်ထဲ ဘာမှ မရှိဘူး။"),
  rule(/^You are holding (.+)\.$/, (m, t) => `${t.P(m[1])} ကိုင်ထားတယ်။`),

  // seasoning
  rule(/^Put (.+) down, then bring the (.+) to it\.$/, (m, t) => `${t.P(m[1])}ကို အရင် ချထားပြီး ${t.P(m[2])}ကို ယူလာပါ။`),
  rule(/^Took the (.+)\.$/, (m, t) => `${t.P(m[1])} ယူလိုက်ပြီ။`),
  rule(/^Use it on the food or dish to season it\.$/, () => "အစားအစာ ဒါမှမဟုတ် ဟင်းပွဲပေါ်မှာ သုံးပြီး ဟင်းခတ်ပါ။"),
  rule(/^Use the (.+) on some food or a dish, or put it back on a spice rack\.$/, (m, t) =>
    `${t.P(m[1])}ကို အစားအစာ ဒါမှမဟုတ် ဟင်းပွဲမှာ သုံးပါ၊ ဒါမှမဟုတ် ဟင်းခတ်စင်ပေါ် ပြန်ထားပါ။`),
  rule(/^Put the (.+) back\.$/, (m, t) => `${t.P(m[1])}ကို ပြန်ထားလိုက်ပြီ။`),
  rule(/^Swapped the (.+) for the (.+)\.$/, (m, t) => `${t.P(m[1])}ကို ${t.P(m[2])} နဲ့ လဲလိုက်ပြီ။`),
  rule(/^It's on fire!$/, () => "မီးလောင်နေတယ်!"),
  rule(new RegExp(`^Put the bottle back and ${HOLD} to smother it\\.$`), (m) => `ပုလင်းကို ပြန်ထားပြီး မီးငြိမ်းဖို့ ${hold(m[1])}ပါ။`),
  rule(new RegExp(`^${HOLD} to smother it\\.$`), (m) => `မီးငြိမ်းဖို့ ${hold(m[1])}ပါ။`),
  rule(/^Nothing here to season\.$/, () => "ဒီမှာ ဟင်းခတ်စရာ မရှိဘူး။"),
  rule(/^A perfect pinch of (.+) on the (.+)!$/, (m, t) => `${t.P(m[2])}ကို ${t.P(m[1])} အကောင်းဆုံး ခတ်လိုက်ပြီ!`),
  rule(/^Too much (.+) on the (.+)!$/, (m, t) => `${t.P(m[2])}မှာ ${t.P(m[1])} များသွားပြီ!`),
  rule(/^The head chef doesn't season the ingredients: finish the plated dish instead\.$/, () =>
    "စားဖိုမှူးချုပ်က ဟင်းချက်ပစ္စည်းတွေကို ဟင်းမခတ်ဘူး — ပန်းကန်ထဲက ဟင်းပွဲကိုပဲ အဆုံးသတ်ပါ။"),
  rule(/^No amount of (.+) will save a burnt (.+)\.$/, (m, t) => `${t.P(m[1])} ဘယ်လောက်ထည့်ထည့် တူးသွားတဲ့ ${t.P(m[2])} ပြန်မကောင်းတော့ဘူး။`),
  rule(/^Seasoned the (.+) with (.+)\.$/, (m, t) => `${t.P(m[1])}ကို ${t.P(m[2])} ခတ်လိုက်ပြီ။`),
  rule(/^Put the food in first, then add (.+)\.$/, (m, t) => `အစားအစာ အရင်ထည့်ပြီးမှ ${t.P(m[1])} ထည့်ပါ။`),
  rule(/^It already has (.+)\.$/, (m, t) => `${t.P(m[1])} ထည့်ပြီးသားပါ။`),
  rule(/^Finished the (.+) with (.+)\.$/, (m, t) => `${t.P(m[1])}ကို ${t.P(m[2])}နဲ့ အဆုံးသတ်လိုက်ပြီ။`),

  // cold food, spoiled food, sniffing
  rule(/^The (.+) sat out of the fridge too long and has gone off\.$/, (m, t) => `${t.P(m[1])} ရေခဲသေတ္တာ အပြင်မှာ ကြာလွန်းလို့ ပုပ်သွားပြီ။`),
  rule(/^Bin it!$/, () => "လွှင့်ပစ်လိုက်ပါ!"),
  rule(/^The (.+) has been out of the fridge a while\.$/, (m, t) => `${t.P(m[1])} ရေခဲသေတ္တာ အပြင်မှာ ကြာနေပြီ။`),
  rule(/^Use it soon or it'll go off\.$/, () => "မြန်မြန် သုံးပါ၊ မဟုတ်ရင် ပုပ်သွားမယ်။"),
  rule(/^You sniff the air\.$/, () => "လေကို အနံ့ခံကြည့်တယ်။"),
  rule(/^Nothing to smell up close\.$/, () => "အနီးမှာ အနံ့ခံစရာ မရှိဘူး။"),
  rule(/^Ugh!$/, () => "ဟာ!"),
  rule(/^The (.+) smells off\.$/, (m, t) => `${t.P(m[1])} အနံ့ဆိုးနေပြီ။`),
  rule(/^The (.+) smells fresh\.$/, (m, t) => `${t.P(m[1])} လတ်ဆတ်တယ်။`),

  // fires and spills
  rule(/^The fire spread to the next stove!$/, () => "မီးက ဘေးမီးဖိုကို ကူးသွားပြီ!"),
  rule(/^The burnt (.+) caught fire!$/, (m, t) => `တူးသွားတဲ့ ${t.P(m[1])} မီးလောင်သွားပြီ!`),
  rule(new RegExp(`^${HOLD} at the stove to smother it\\.$`), (m) => `မီးငြိမ်းဖို့ မီးဖိုမှာ ${hold(m[1])}ပါ။`),
  rule(/^The fire's out\.$/, () => "မီးငြိမ်းသွားပြီ။"),
  rule(/^The stove is free again\.$/, () => "မီးဖို ပြန်သုံးလို့ ရပြီ။"),
  rule(/^A bottle of oil smashed on the floor!$/, () => "ဆီပုလင်း ကြမ်းပေါ် ကွဲသွားပြီ!"),
  rule(new RegExp(`^It's slippery: ${HOLD} on the puddle to mop it\\.$`), (m) => `ချော်တယ် — သုတ်ဖို့ ဆီအိုင်ပေါ်မှာ ${hold(m[1])}ပါ။`),
  rule(/^Mopped up the spill\.$/, () => "ဖိတ်ထားတာကို သုတ်ပြီးပြီ။"),

  // the head chef's limits
  rule(/^The head chef doesn't cook\.$/, () => "စားဖိုမှူးချုပ်က ဟင်းမချက်ဘူး။"),
  rule(/^Ask a cook to fetch the ingredients\.$/, () => "ဟင်းချက်ပစ္စည်း သွားယူဖို့ စားဖိုမှူးတစ်ယောက်ကို ခိုင်းပါ။"),
  rule(/^Ask a cook to make the soup\.$/, () => "စွပ်ပြုတ်ချက်ဖို့ စားဖိုမှူးတစ်ယောက်ကို ခိုင်းပါ။"),
  rule(/^Ask a cook to take this\.$/, () => "ဒါကို ယူဖို့ စားဖိုမှူးတစ်ယောက်ကို ခိုင်းပါ။"),
  rule(/^Ask a cook to chop that\.$/, () => "အဲဒါကို လှီးဖို့ စားဖိုမှူးတစ်ယောက်ကို ခိုင်းပါ။"),
  rule(/^Ask a cook to handle the food, or bring a plate to plate it\.$/, () =>
    "အစားအစာကို စားဖိုမှူးတစ်ယောက်ကို ကိုင်ခိုင်းပါ၊ ဒါမှမဟုတ် ပန်းကန်ပြား ယူလာပြီး ထည့်ပါ။"),

  // handing over, holding hands
  rule(/^(.+) handed (?:the )?(.+) to (.+)\.$/, (m, t) => `${nm(m[1], t)} က ${t.P(m[2])}ကို ${nm(m[3], t)} ဆီ လှမ်းပေးလိုက်တယ်။`),
  rule(/^(.+) is in front of you\.$/, (m, t) => `${nm(m[1], t)} ရှေ့မှာ ရှိတယ်။`),
  rule(/^You have nothing to give\.$/, () => "ပေးစရာ ဘာမှ မရှိဘူး။"),
  rule(/^(.+) doesn't handle raw food\.$/, (m, t) => `${nm(m[1], t)}က အစိမ်းတွေကို မကိုင်ဘူး။`),
  rule(/^Hand it over on a plate\.$/, () => "ပန်းကန်ပြားပေါ် တင်ပြီး လှမ်းပေးပါ။"),
  rule(/^(.+)'s hands are full\.$/, (m, t) => `${nm(m[1], t)} လက်မအားဘူး။`),
  rule(/^You lost (.+)'s hand\.$/, (m, t) => `${nm(m[1], t)} နဲ့ လက်ပြုတ်သွားပြီ။`),
  rule(/^You let go of (.+)'s hand\.$/, (m, t) => `${nm(m[1], t)} ရဲ့ လက်ကို လွှတ်လိုက်ပြီ။`),
  rule(/^(.+) lets go of (.+)'s hand\.$/, (m, t) => `${nm(m[1], t)} က ${nm(m[2], t)} ရဲ့ လက်ကို လွှတ်လိုက်တယ်။`),
  rule(/^Face a teammate to take their hand\.$/, () => "လက်ဆွဲဖို့ အဖွဲ့သားဘက် လှည့်ပါ။"),
  rule(/^(.+) takes (.+)'s hand and leads the way\.$/, (m, t) => `${nm(m[1], t)} က ${nm(m[2], t)} ရဲ့ လက်ကို ဆွဲပြီး လမ်းပြတယ်။`),
  rule(/^(.+) is leading you by the hand\.$/, (m, t) => `${nm(m[1], t)} က လက်ဆွဲပြီး ခေါ်သွားနေတယ်။`),

  // signals
  rule(/^(.+) pings: (.+?)(?: at the (.+))?\.$/, (m, t) => `${nm(m[1], t)} က ညွှန်ပြတယ်: ${t.P(m[2])}${m[3] ? ` (${t.P(m[3])}မှာ)` : ""}။`),
  rule(/^(.+) signals: (\w+)!$/, (m, t) => `${nm(m[1], t)} က အချက်ပြတယ်: ${t.tr(m[2])}!`),
  rule(/^Ding!$/, () => "ဒင်!"),
  rule(/^The bell rings\.$/, () => "ခေါင်းလောင်း မြည်တယ်။"),
  rule(/^The tables didn't follow your signs\.$/, () => "စားပွဲတွေက လက်ဟန်ကို နားမလည်ဘူး။"),
  rule(/^Try again!$/, () => "ထပ်ကြိုးစားပါ!"),
  rule(/^(.+) waves to the tables( with a flourish)?\.$/, (m, t) => `${nm(m[1], t)} က စားပွဲတွေကို ${m[2] ? "လှလှပပ " : ""}လက်ပြတယ်။`),
  rule(/^Everyone is happy to wait (\d+) seconds longer\.$/, (m) => `အားလုံး ${m[1]} စက္ကန့် ပိုစောင့်ပေးမယ်။`),

  // looking around (Q)
  rule(/^In front of you: (.+?), holding (.+)\.$/, (m, t) => {
    const items = m[2].split(", ").map((x) => x.replace(/^(\d+) (.+)$/, (_, n: string, k: string) => `${n} ${t.P(k)}`));
    return `ရှေ့မှာ: ${t.P(m[1])} — ${items.join("၊ ")}။`;
  }),
  rule(/^In front of you: (.+?) with (.+)\.$/, (m, t) => `ရှေ့မှာ: ${t.P(m[1])} (${t.P(m[2])} ရှိတယ်)။`),
  rule(/^In front of you: (.+ \((?:head chef|deaf chef|mute chef|all senses \(solo\))\))\.$/, (m, t) => `ရှေ့မှာ: ${nm(m[1], t)}။`),
  rule(/^In front of you: (.+)\.$/, (m, t) => `ရှေ့မှာ: ${t.P(m[1])}။`),
  rule(/^You have (.+) chosen\.$/, (m, t) => `${t.P(m[1])}ကို ရွေးထားတယ်။`),
  rule(/^Nothing is in front of you\.$/, () => "ရှေ့မှာ ဘာမှ မရှိဘူး။"),
  rule(/^There's nothing in front of you\.$/, () => "ရှေ့မှာ ဘာမှ မရှိဘူး။"),
  rule(/^Orders you know about: (.+)\.$/, (m, t) =>
    `သိထားတဲ့ အော်ဒါ: ${m[1].split("; ").map((o) => o.replace(/^(.+) \((ticket|phone)\)$/, (_, dish: string, ch: string) => `${t.P(dish)} (${ch === "phone" ? "ဖုန်း" : "စာရွက်"})`)).join("၊ ")}။`),
  rule(/^You don't know of any orders right now\.$/, () => "အခု သိထားတဲ့ အော်ဒါ မရှိသေးဘူး။"),
  rule(/^Next: (.+?)\.?$/, (m, t) => `နောက်တစ်ဆင့်: ${t.tr(m[1])}။`),

  // ======================================================================== the coach (next step)
  rule(/^key (\d+)$/, (m) => `ခလုတ် ${m[1]}`),
  rule(new RegExp(`^${HOLD}$`), (m) => hold(m[1])),
  rule(/^Nothing waiting on you: take the dirty dishes from the (dirty dish counter|pass) to the sink$/, (m, t) =>
    `လုပ်စရာ မရှိသေးဘူး: ${t.P(m[1])}က ပန်းကန်ညစ်တွေကို ဘေစင်ဆီ ယူသွားပါ`),
  rule(/^Nothing waiting on you: wash up at the sink$/, () => "လုပ်စရာ မရှိသေးဘူး: ဘေစင်မှာ ပန်းကန်ဆေးပါ"),
  rule(/^Everything's on the go: keep an eye on the tickets$/, () => "အကုန် ချက်နေပြီ: အော်ဒါတွေကို စောင့်ကြည့်ပါ"),
  rule(/^Take the dirty (plate|bowl) to the sink$/, (m, t) => `${t.P(`dirty ${m[1]}`)}ကို ဘေစင်ဆီ ယူသွားပါ`),
  rule(/^Nothing needs this (plate|bowl) now: put it back on the (plate|bowl) rack$/, (m, t) =>
    `ဒီ${t.P(m[1])} အခု မလိုသေးဘူး: ${t.P(`${m[2]} rack`)}ပေါ် ပြန်ထားပါ`),
  rule(/^No order needs the (.+) now: put it back$/, (m, t) => `${t.P(m[1])}ကို ဘယ်အော်ဒါမှ မလိုသေးဘူး: ပြန်ထားပါ`),
  rule(/^No order needs the (.+) now: bin it$/, (m, t) => `${t.P(m[1])}ကို ဘယ်အော်ဒါမှ မလိုတော့ဘူး: လွှင့်ပစ်ပါ`),
  rule(/^Bin the (.+): pick it up and take it to the bin$/, (m, t) => `${t.P(m[1])}ကို လွှင့်ပစ်ပါ: ကောက်ပြီး အမှိုက်ပုံးဆီ ယူသွားပါ`),
  rule(/^The soup burnt: scrape out the pot$/, () => "စွပ်ပြုတ် တူးသွားပြီ: အိုးကို ခြစ်ထုတ်ပါ"),
  rule(/^use it with empty hands$/, () => "လက်အလွတ်နဲ့"),
  rule(/^Season the (.+) with (.+)$/, (m, t) => `${t.P(m[1])}ကို ${t.P(m[2])} ခတ်ပါ`),
  rule(/^Swap the (.+) for the (.+) at the spice rack$/, (m, t) => `ဟင်းခတ်စင်မှာ ${t.P(m[1])}ကို ${t.P(m[2])} နဲ့ လဲပါ`),
  rule(/^Put the (.+) back on the spice rack$/, (m, t) => `${t.P(m[1])}ကို ဟင်းခတ်စင်ပေါ် ပြန်ထားပါ`),
  rule(/^Table (\d+) wants to pay by (\w+): ring them up at the till$/, (m) => `စားပွဲ ${m[1]} က ${pay(m[2])}နဲ့ ရှင်းချင်တယ်: ငွေရှင်းကောင်တာမှာ ငွေရှင်းပေးပါ`),
  rule(/^Ask a cook for (.+)$/, (m, t) => `စားဖိုမှူးတစ်ယောက်ကို ${t.tr(m[1])} တောင်းပါ`),
  rule(/^The head chef doesn't cook: play as a cook, or add the helper bot$/, () =>
    "စားဖိုမှူးချုပ်က ဟင်းမချက်ဘူး: စားဖိုမှူးအဖြစ် ကစားပါ၊ ဒါမှမဟုတ် အကူစက်ရုပ် ထည့်ပါ"),
  rule(/^Put the (.+?) down, then bin the (.+) from the (.+)$/, (m, t) => `${t.P(m[1])}ကို အရင်ချပြီး ${t.P(m[3])}ပေါ်က ${t.P(m[2])}ကို လွှင့်ပစ်ပါ`),
  rule(/^Every (.+) is in use: wait for one to free up$/, (m, t) => `${t.P(m[1])} အားလုံး သုံးနေတယ်: တစ်ခု အားတာ စောင့်ပါ`),
  rule(new RegExp(`^No clean (plate|bowl)s: ${HOLD} at the sink to wash one$`), (m, t) => `${t.P(m[1])} သန့်သန့် မရှိဘူး: ဘေစင်မှာ ${hold(m[2])}ပြီး တစ်ခု ဆေးပါ`),
  rule(/^No clean (plate|bowl)s: take a dirty (plate|bowl) from the (dirty dish counter|pass) to the sink$/, (m, t) =>
    `${t.P(m[1])} သန့်သန့် မရှိဘူး: ${t.P(m[3])}က ${t.P(`dirty ${m[2]}`)}ကို ဘေစင်ဆီ ယူသွားပါ`),
  rule(/^No clean (plate|bowl)s: wait for a customer to bring one back$/, (m, t) => `${t.P(m[1])} သန့်သန့် မရှိဘူး: ဧည့်သည် ပြန်ယူလာတာ စောင့်ပါ`),
  rule(/^Bin the (.+) and start again$/, (m, t) => `${t.P(m[1])}ကို လွှင့်ပစ်ပြီး အစက ပြန်စပါ`),
  rule(new RegExp(`^Chop the (.+): put it on a cutting board, then ${HOLD}$`), (m, t) => `${t.P(m[1])}ကို လှီးပါ: စဉ်းတီတုံးပေါ် တင်ပြီး ${hold(m[2])}ပါ`),
  rule(/^Put the (.+?) down, then bring the (.+) to it$/, (m, t) => `${t.P(m[1])}ကို အရင် ချထားပြီး ${t.P(m[2])}ကို ယူလာပါ`),
  rule(/^Fry the (.+): put it on a stove$/, (m, t) => `${t.P(m[1])}ကို ကြော်ပါ: မီးဖိုပေါ် တင်ပါ`),
  rule(/^Put the (.+) in the soup pot$/, (m, t) => `${t.P(m[1])}ကို စွပ်ပြုတ်အိုးထဲ ထည့်ပါ`),
  rule(/^The soup burnt: put the (.+) down, then scrape out the pot$/, (m, t) => `စွပ်ပြုတ် တူးသွားပြီ: ${t.P(m[1])}ကို အရင်ချပြီး အိုးကို ခြစ်ထုတ်ပါ`),
  rule(/^The pot is busy: put the (.+) down on a counter for the next soup$/, (m, t) => `အိုးက သုံးနေတယ်: နောက်စွပ်ပြုတ်အတွက် ${t.P(m[1])}ကို ကောင်တာပေါ် ချထားပါ`),
  rule(/^Add the (.+) to the plate$/, (m, t) => `${t.P(m[1])}ကို ပန်းကန်ပြားထဲ ထည့်ပါ`),
  rule(/^Every counter is full: hand it to a teammate, or wait for a space$/, () => "ကောင်တာ အားလုံး ပြည့်နေတယ်: အဖွဲ့သားကို လှမ်းပေးပါ၊ ဒါမှမဟုတ် နေရာလွတ်တာ စောင့်ပါ"),
  rule(/^Put the (.+) down on a counter: the head chef plates it$/, (m, t) => `${t.P(m[1])}ကို ကောင်တာပေါ် ချထားပါ: စားဖိုမှူးချုပ်က ပန်းကန်ထဲ ထည့်ပေးမယ်`),
  rule(/^Put it down on a counter and fetch a plate$/, () => "ကောင်တာပေါ် ချထားပြီး ပန်းကန်ပြား သွားယူပါ"),
  rule(/^Put the (plate|bowl) down, then scrape out the burnt pot$/, (m, t) => `${t.P(m[1])}ကို အရင်ချပြီး တူးသွားတဲ့ အိုးကို ခြစ်ထုတ်ပါ`),
  rule(/^Ladle the soup into your bowl$/, () => "စွပ်ပြုတ်ကို ပန်းကန်လုံးထဲ ခပ်ထည့်ပါ"),
  rule(/^Take a bowl from the bowl rack$/, () => "ပန်းကန်လုံးစင်က ပန်းကန်လုံး တစ်လုံး ယူပါ"),
  rule(/^The soup is boiling: wait by the pot with your bowl$/, () => "စွပ်ပြုတ် ဆူနေတယ်: ပန်းကန်လုံး ကိုင်ပြီး အိုးဘေးမှာ စောင့်ပါ"),
  rule(/^The soup is boiling: grab a bowl and wait$/, () => "စွပ်ပြုတ် ဆူနေတယ်: ပန်းကန်လုံး ယူပြီး စောင့်ပါ"),
  rule(/^Put the (plate|bowl) (back|down), then fetch the (.+) for the pot$/, (m, t) =>
    `${t.P(m[1])}ကို အရင် ${m[2] === "back" ? "ပြန်ထား" : "ချထား"}ပြီး အိုးအတွက် ${t.P(m[3])} သွားယူပါ`),
  rule(/^Pick up the (.+) and put it in the soup pot(?: (\(\d+ of \d+ in\)))?$/, (m, t) => `${t.P(m[1])}ကို ကောက်ပြီး စွပ်ပြုတ်အိုးထဲ ထည့်ပါ${m[2] ? ` ${t.tr(m[2])}` : ""}`),
  rule(new RegExp(`^Chop the (.+) for the pot: ${HOLD} at the board$`), (m, t) => `အိုးအတွက် ${t.P(m[1])}ကို လှီးပါ: စဉ်းတီတုံးမှာ ${hold(m[2])}ပါ`),
  rule(/^Pick up the (.+) for the pot$/, (m, t) => `အိုးအတွက် ${t.P(m[1])}ကို ကောက်ယူပါ`),
  rule(/^Take an? (.+?) (to chop for the pot|for the pot)(?: (\(\d+ of \d+ in\)))?$/, (m, t) =>
    `အိုးအတွက် ${m[2].startsWith("to chop") ? "လှီးဖို့ " : ""}${t.P(m[1])} ယူပါ${m[3] ? ` ${t.tr(m[3])}` : ""}`),
  rule(/^an? (.+) for the soup(?: (\(\d+ of \d+ in\)))?$/, (m, t) => `စွပ်ပြုတ်အတွက် ${t.P(m[1])}${m[2] ? ` ${t.tr(m[2])}` : ""}`),
  rule(/^\((\d+) of (\d+) in\)$/, (m) => `(${m[2]} ခုမှာ ${m[1]} ခု ထည့်ပြီး)`),
  rule(/^Put the (plate|bowl) down, then move the (.+) off the board$/, (m, t) => `${t.P(m[1])}ကို အရင်ချပြီး ${t.P(m[2])}ကို စဉ်းတီတုံးပေါ်က ရွှေ့ပါ`),
  rule(/^Move the (.+) off the board onto a counter for the head chef$/, (m, t) => `စားဖိုမှူးချုပ်အတွက် ${t.P(m[1])}ကို စဉ်းတီတုံးပေါ်က ကောင်တာပေါ် ရွှေ့ပေးပါ`),
  rule(/^Pick up the plate, then add the (.+)$/, (m, t) => `ပန်းကန်ပြားကို ကောက်ပြီး ${t.P(m[1])} ထည့်ပါ`),
  rule(/^Add the (.+) to your plate$/, (m, t) => `${t.P(m[1])}ကို ပန်းကန်ပြားထဲ ထည့်ပါ`),
  rule(/^Get a plate, then add the (.+)$/, (m, t) => `ပန်းကန်ပြား ယူပြီး ${t.P(m[1])} ထည့်ပါ`),
  rule(/^Pick up the (.+) and add it to the plate$/, (m, t) => `${t.P(m[1])}ကို ကောက်ပြီး ပန်းကန်ပြားထဲ ထည့်ပါ`),
  rule(new RegExp(`^Put the plate down, then chop the (.+) \\(${HOLD}\\)$`), (m, t) => `ပန်းကန်ပြားကို အရင်ချပြီး ${t.P(m[1])}ကို လှီးပါ (${hold(m[2])})`),
  rule(new RegExp(`^Chop the (.+): ${HOLD} at the board$`), (m, t) => `${t.P(m[1])}ကို လှီးပါ: စဉ်းတီတုံးမှာ ${hold(m[2])}ပါ`),
  rule(/^Put the (plate|bowl) down, then season the (.+)$/, (m, t) => `${t.P(m[1])}ကို အရင်ချပြီး ${t.P(m[2])}ကို ဟင်းခတ်ပါ`),
  rule(/^Take the (.+) from the spice rack for the (.+)$/, (m, t) => `${t.P(m[2])}အတွက် ဟင်းခတ်စင်က ${t.P(m[1])} ယူပါ`),
  rule(/^Take the (.+) off the stove!$/, (m, t) => `${t.P(m[1])}ကို မီးဖိုပေါ်က ချပါ!`),
  rule(/^The (.+?) (?:is|are) cooking: watch (?:it|them)$/, (m, t) => `${t.P(m[1])} ကျက်နေပြီ: စောင့်ကြည့်ပါ`),
  rule(/^Put the plate down, then pick up the (.+)$/, (m, t) => `ပန်းကန်ပြားကို အရင်ချပြီး ${t.P(m[1])}ကို ကောက်ယူပါ`),
  rule(/^Put the plate down, then fetch (.+)$/, (m, t) => `ပန်းကန်ပြားကို အရင်ချပြီး ${t.P(m[1])} သွားယူပါ`),
  rule(/^Take an? (.+) from the (.+)$/, (m, t) => `${t.P(m[2])}က ${t.P(m[1])} ယူပါ`),
  rule(/^Pick up the (.+)$/, (m, t) => `${t.P(m[1])}ကို ကောက်ယူပါ`),
  rule(/^Add the (.+)$/, (m, t) => `${t.P(m[1])}ကို ထည့်ပါ`),
  rule(/^Serve it at the pass!$/, () => "ဟင်းထုတ်ကောင်တာမှာ ပွဲချပါ!"),
  // the checklist's steps
  rule(/^Take (.+)$/, (m, t) => `${t.P(m[1])} ယူ`),
  rule(/^Season: (.+)$/, (m, t) => `ဟင်းခတ်: ${t.P(m[1])}`),
  rule(/^Then (.+)$/, (m, t) => `ပြီးရင် ${t.P(m[1])}`),
  rule(/^Finish: (.+)$/, (m, t) => `အဆုံးသတ်: ${t.P(m[1])}`),
  rule(/^Soup of (.+)$/, (m, t) => `${t.P(m[1])} စွပ်ပြုတ်`),
  rule(/^Burnt!$/, () => "တူးသွားပြီ!"),
  rule(/^Fry it$/, () => "ကြော်"),
  rule(/^Into the soup pot$/, () => "စွပ်ပြုတ်အိုးထဲ ထည့်"),
  rule(/^Onto a plate$/, () => "ပန်းကန်ပြားပေါ် တင်"),
  rule(/^(.+), (.+) (before|after) cooking$/, (m, t) => `${t.P(m[1])}၊ ${t.P(m[2])} ${m[3] === "before" ? "မချက်ခင် ခတ်" : "ချက်ပြီးမှ ခတ်"}`),
  rule(/^(.+) (before|after) cooking$/, (m, t) => `${t.P(m[1])} ${m[2] === "before" ? "မချက်ခင် ခတ်" : "ချက်ပြီးမှ ခတ်"}`),
  rule(/^finish with (.+)$/, (m, t) => `${t.P(m[1])}နဲ့ အဆုံးသတ်`),
  rule(/^([^·]+) has it$/, (m, t) => `${nm(m[1], t)} ဆီမှာ ရှိတယ်`),

  // ======================================================================== action hints (what Use would do)
  rule(/^Hold: (.+)$/, (m, t) => `ဖိထား: ${t.tr(m[1])}`),
  rule(/^[Ss]eason (.+)'s (.+): (.+)$/, (m, t) => `${nm(m[1], t)} ရဲ့ ${t.P(m[2])}ကို ခတ်: ${t.P(m[3])}`),
  rule(/^Hand the (.+) to (.+)$/, (m, t) => `${t.P(m[1])}ကို ${nm(m[2], t)} ဆီ ပေး`),
  rule(/^Take the (.+) to some food or a dish$/, (m, t) => `${t.P(m[1])}ကို အစားအစာ ဒါမှမဟုတ် ဟင်းပွဲဆီ ယူသွား`),
  rule(/^Put the (.+) back$/, (m, t) => `${t.P(m[1])}ကို ပြန်ထား`),
  rule(/^Swap for the (.+)$/, (m, t) => `${t.P(m[1])} နဲ့ လဲ`),
  rule(/^Nothing here to season$/, () => "ဒီမှာ ဟင်းခတ်စရာ မရှိ"),
  rule(/^Cooks season the ingredients$/, () => "ဟင်းချက်ပစ္စည်းကို စားဖိုမှူးတွေက ခတ်တယ်"),
  rule(/^Too late, it's burnt$/, () => "နောက်ကျသွားပြီ၊ တူးသွားပြီ"),
  rule(/^The (.+) already has (.+)$/, (m, t) => `${t.P(m[1])}မှာ ${t.P(m[2])} ပါပြီးသား`),
  rule(/^[Ss]eason the (.+): (.+)$/, (m, t) => `${t.P(m[1])}ကို ခတ်: ${t.P(m[2])}`),
  rule(/^Put the food in first$/, () => "အစားအစာ အရင် ထည့်"),
  rule(/^Already has (.+)$/, (m, t) => `${t.P(m[1])} ပါပြီးသား`),
  rule(/^[Aa]dd (.+) to the plate$/, (m, t) => `ပန်းကန်ပြားထဲ ${t.P(m[1])} ထည့်`),
  rule(/^[Aa]dd (.+)$/, (m, t) => `${t.P(m[1])} ထည့်`),
  rule(/^Hold to mop the spill$/, () => "ဖိထားပြီး ဆီဖိတ်တာ သုတ်"),
  rule(/^Put on (.+)'s plate$/, (m, t) => `${nm(m[1], t)} ရဲ့ ပန်းကန်ပြားပေါ် တင်`),
  rule(/^Hand to (.+)$/, (m, t) => `${nm(m[1], t)} ဆီ ပေး`),
  rule(/^Take (.+)'s hand$/, (m, t) => `${nm(m[1], t)} ရဲ့ လက်ကို ဆွဲ`),
  rule(/^Hold to smother the fire!$/, () => "ဖိထားပြီး မီးငြိမ်း!"),
  rule(/^Back in the fridge$/, () => "ရေခဲသေတ္တာထဲ ပြန်ထည့်"),
  rule(/^Back on the shelf$/, () => "စင်ပေါ် ပြန်ထား"),
  rule(/^Put it back$/, () => "ပြန်ထား"),
  rule(/^Plate is full$/, () => "ပန်းကန်ပြား ပြည့်ပြီ"),
  rule(/^Hands full$/, () => "လက်မအား"),
  rule(/^Dirty: wash it at the sink first$/, () => "ညစ်နေတယ်: ဘေစင်မှာ အရင် ဆေး"),
  rule(/^No clean (plate|bowl)s: wash some at the sink$/, (m, t) => `${t.P(m[1])} သန့်သန့် မရှိ: ဘေစင်မှာ ဆေး`),
  rule(/^Take a (plate|bowl) \((\d+) clean\)$/, (m, t) => `${t.P(m[1])} ယူ (သန့်တာ ${m[2]} ခု)`),
  rule(/^Plate it$/, () => "ပန်းကန်ပြားပေါ် တင်"),
  rule(/^Empty the plate$/, () => "ပန်းကန်ပြား သွန်"),
  rule(/^Pour it away$/, () => "သွန်ပစ်"),
  rule(/^Serve!$/, () => "ပွဲချ!"),
  rule(/^Put out a booster seat$/, () => "ကလေးထိုင်ခုံ ထုတ်ပေး"),
  rule(/^Plate it first$/, () => "ပန်းကန်ပြားပေါ် အရင် တင်"),
  rule(/^Bring a finished dish$/, () => "ပြီးပြီးသား ဟင်းပွဲ ယူလာ"),
  rule(/^Wave again in (\d+)s$/, (m) => `${m[1]} စက္ကန့်နေရင် ထပ်လက်ပြလို့ ရမယ်`),
  rule(/^Wave: tables wait longer$/, () => "လက်ပြ: စားပွဲတွေ ပိုစောင့်မယ်"),
  rule(/^Put it back on the pile$/, () => "အပုံပေါ် ပြန်တင်"),
  rule(/^For dirty dishes$/, () => "ပန်းကန်ညစ်အတွက်"),
  rule(/^Take a dirty dish \((\d+) here\)$/, (m) => `ပန်းကန်ညစ် ယူ (ဒီမှာ ${m[1]} ခု)`),
  rule(/^No dirty dishes yet$/, () => "ပန်းကန်ညစ် မရှိသေး"),
  rule(/^Put the dirty (plate|bowl) in the sink$/, (m, t) => `${t.P(`dirty ${m[1]}`)}ကို ဘေစင်ထဲ ထည့်`),
  rule(/^Nothing to wash$/, () => "ဆေးစရာ မရှိ"),
  rule(/^Empty hands to wash up$/, () => "ပန်းကန်ဆေးဖို့ လက်အလွတ် ဖြစ်ရမယ်"),
  rule(/^Hold to wash \((\d+) dirty\)$/, (m) => `ဖိထားပြီး ဆေး (ညစ်တာ ${m[1]} ခု)`),
  rule(/^Take (\d+) coins by (\w+)$/, (m) => `${pay(m[2])}နဲ့ ဒင်္ဂါး ${m[1]} ယူ`),
  rule(/^Put it down, then bring the spice to it$/, () => "ချထားပြီး ဟင်းခတ်ကို ယူလာ"),
  rule(/^Burnt! Empty hands to scrape$/, () => "တူးသွားပြီ! ခြစ်ဖို့ လက်အလွတ် ဖြစ်ရမယ်"),
  rule(/^Scrape out the burnt soup$/, () => "တူးသွားတဲ့ စွပ်ပြုတ်ကို ခြစ်ထုတ်"),
  rule(/^Doesn't go in soup$/, () => "စွပ်ပြုတ်ထဲ မထည့်ရ"),
  rule(/^Chop it first$/, () => "အရင် လှီး"),
  rule(/^Not like that$/, () => "အဲလို မဟုတ်ဘူး"),
  rule(/^Add to pot \((\d+)\/(\d+)\)$/, (m) => `အိုးထဲ ထည့် (${m[1]}/${m[2]})`),
  rule(/^Ladle (.+)$/, (m, t) => `${t.P(m[1])} ခပ်`),
  rule(/^Boiling… (\d+)s$/, (m) => `ဆူနေတယ်… ${m[1]} စက္ကန့်`),
  rule(/^Soup's ready — bring a bowl$/, () => "စွပ်ပြုတ် ရပြီ — ပန်းကန်လုံး ယူလာ"),
  rule(/^Pot: (\d+)\/(\d+) chopped veg$/, (m) => `အိုး: ဟင်းသီးဟင်းရွက်လှီး ${m[1]}/${m[2]}`),
  rule(/^Take it off — now!$/, () => "ချ — အခုပဲ!"),
  rule(/^Pick up (.+)$/, (m, t) => `${t.P(m[1])} ကောက်ယူ`),
  rule(/^Can't cook that$/, () => "အဲဒါ ချက်လို့ မရ"),
  rule(/^Plates go on a counter$/, () => "ပန်းကန်ပြားကို ကောင်တာပေါ် တင်"),
  rule(/^Put on the board$/, () => "စဉ်းတီတုံးပေါ် တင်"),
  rule(/^Put it down$/, () => "ချထား"),
  rule(/^That plate's dirty$/, () => "ပန်းကန်ပြား ညစ်နေတယ်"),
  rule(/^Add to the plate$/, () => "ပန်းကန်ပြားထဲ ထည့်"),
  rule(/^Put on your tray$/, () => "ဗန်းပေါ် တင်"),
  rule(/^(.+) is taken$/, (m, t) => `${t.P(m[1])} မအား`),

  // ======================================================================== toasts (a few words)
  rule(/^You're the (.+)$/, (m, t) => `${t.P(m[1])} ဖြစ်ပြီ`),
  rule(/^Kitchen open: (.+)$/, (m, t) => `မီးဖိုချောင် ဖွင့်ပြီ: ${t.P(m[1])}`),
  rule(/^Only the mute chef signals$/, () => "အချက်ပြတာ စကားမပြောနိုင်တဲ့ စားဖိုမှူးပဲ"),
  rule(/^(.+) for a kid: plain$/, (m, t) => `ကလေးအတွက် ${t.P(m[1])} — ဟင်းမခတ်`),
  rule(/^(.+) by phone, plain$/, (m, t) => `ဖုန်းနဲ့ ${t.P(m[1])} — ဟင်းမခတ်`),
  rule(/^(.+) by phone$/, (m, t) => `ဖုန်းနဲ့ ${t.P(m[1])}`),
  rule(/^(.+) \+(\d+)$/, (m, t) => `${t.P(m[1])} +${m[2]}`),
  rule(/^(.+) is cooked$/, (m, t) => `${t.P(m[1])} ကျက်ပြီ`),
  rule(/^(.+) is ready$/, (m, t) => `${t.P(m[1])} ရပြီ`),
  rule(/^(.+) is perfect now!$/, (m, t) => `${t.P(m[1])} အခု အကောင်းဆုံး!`),
  rule(/^(.+) is burning!$/, (m, t) => `${t.P(m[1])} တူးတော့မယ်!`),
  rule(/^(.+) burnt$/, (m, t) => `${t.P(m[1])} တူးသွားပြီ`),
  rule(/^(.+) went off\.$/, (m, t) => `${t.P(m[1])} ပုပ်သွားပြီ။`),
  rule(/^(.+) is getting warm$/, (m, t) => `${t.P(m[1])} ပူလာပြီ`),
  rule(/^(.+) lost -(\d+)$/, (m, t) => `${t.P(m[1])} ဆုံးရှုံး -${m[2]}`),
  rule(/^Customer sick! -(\d+)$/, (m) => `ဧည့်သည် နေမကောင်း! -${m[1]}`),
  rule(/^Nobody ordered that$/, () => "ဘယ်သူမှ မမှာထားဘူး"),
  rule(/^Power cut!$/, () => "မီးပျက်ပြီ!"),
  rule(/^Storm! No sound$/, () => "မုန်တိုင်း! အသံမကြားရ"),
  rule(/^Lights back on$/, () => "မီးပြန်လာပြီ"),
  rule(/^Storm over$/, () => "မုန်တိုင်း ကုန်ပြီ"),
  rule(/^(Table \d+) pays by (\w+)$/, (m) => `${table(m[1])} က ${pay(m[2])}နဲ့ ရှင်းမယ်`),
  rule(/^(Table \d+) left unpaid$/, (m) => `${table(m[1])} ငွေမရှင်းဘဲ ထွက်သွားပြီ`),
  rule(/^(Table \d+) paid (\d+) coins$/, (m) => `${table(m[1])} ဒင်္ဂါး ${m[2]} ရှင်းပြီ`),
  rule(/^Tables wait longer$/, () => "စားပွဲတွေ ပိုစောင့်မယ်"),
  rule(/^Look here$/, () => "ဒီကို ကြည့်"),
  rule(/^Combo ×(\d+) \+(\d+)$/, (m) => `ဆက်တိုက် ×${m[1]} +${m[2]}`),
  rule(/^Rush hour! Pay ×1\.5$/, () => "လူစည်ချိန်! ငွေ ×1.5"),
  rule(/^Overtime! Keep cooking$/, () => "အချိန်ပို! ဆက်ချက်"),
  rule(/^High score: (\d+)$/, (m) => `အမှတ်အမြင့်ဆုံး: ${m[1]}`),
  rule(/^Rush hour over$/, () => "လူစည်ချိန် ပြီးပြီ"),
  rule(/^Critic at (Table \d+)$/, (m) => `${table(m[1])} မှာ ဝေဖန်ရေးဆရာ`),
  rule(/^A food critic is here$/, () => "ဝေဖန်ရေးဆရာ ရောက်နေပြီ"),
  rule(/^Rave review! \+(\d+)$/, (m) => `အကောင်းဆုံး သုံးသပ်ချက်! +${m[1]}`),
  rule(/^Critic walked out -(\d+)$/, (m) => `ဝေဖန်ရေးဆရာ ထွက်သွားပြီ -${m[1]}`),
  rule(new RegExp(`^Fire spread! ${HOLD} at it$`), (m) => `မီးကူးပြီ! ${hold(m[1])}`),
  rule(new RegExp(`^${HOLD} at it$`), (m) => hold(m[1])),
  rule(new RegExp(`^${HOLD} at the stove$`), (m) => `မီးဖိုမှာ ${hold(m[1])}`),
  rule(new RegExp(`^${HOLD} to mop$`), (m) => `သုတ်ဖို့ ${hold(m[1])}`),
  rule(new RegExp(`^Fire! ${HOLD} at the stove$`), (m) => `မီး! မီးဖိုမှာ ${hold(m[1])}`),
  rule(/^Fire's out$/, () => "မီးငြိမ်းပြီ"),
  rule(new RegExp(`^On fire! ${HOLD}$`), (m) => `မီးလောင်နေ! ${hold(m[1])}`),
  rule(new RegExp(`^Oil spill! ${HOLD} to mop$`), (m) => `ဆီဖိတ်! သုတ်ဖို့ ${hold(m[1])}`),
  rule(/^Spill mopped$/, () => "သုတ်ပြီးပြီ"),
  rule(/^(plate|bowl) clean$/, (m, t) => `${t.P(m[1])} သန့်ပြီ`),
  rule(/^(\d+) to go$/, (m) => `${m[1]} ခု ကျန်`),
  rule(/^All dishes clean!$/, () => "ပန်းကန် အားလုံး သန့်ပြီ!"),
  rule(/^No clean (plates|bowls)! Wash some$/, (m, t) => `${t.P(m[1])} သန့်သန့် မရှိ! ဆေးပါ`),
  rule(/^Daily special \+(\d+) coins$/, (m) => `နေ့စဉ် အထူး +${m[1]} ဒင်္ဂါး`),
  rule(/^Best today: (\d+)$/, (m) => `ဒီနေ့ အကောင်းဆုံး: ${m[1]}`),
  rule(/^Bought (.+)$/, (m, t) => `${t.tr(m[1])} ဝယ်ပြီ`),
  rule(/^Connection lost\. Reconnecting…$/, () => "ချိတ်ဆက်မှု ပြတ်သွားတယ်။ ပြန်ချိတ်နေတယ်…"),
  rule(/^Reconnected$/, () => "ပြန်ချိတ်မိပြီ"),
  rule(/^Connection lost\. Refresh$/, () => "ချိတ်ဆက်မှု ပြတ်သွားတယ်။ ပြန်ဖွင့်ပါ"),
  rule(/^Hand it over on a plate$/, () => "ပန်းကန်ပြားနဲ့ လှမ်းပေး"),
  rule(/^Nothing to give$/, () => "ပေးစရာ မရှိ"),
  rule(/^Ask a cook to do that$/, () => "စားဖိုမှူးကို ခိုင်း"),
  rule(/^Bring food to season$/, () => "ဟင်းခတ်ဖို့ အစားအစာ ယူလာ"),
  rule(/^Burnt (.+) can't be saved$/, (m, t) => `တူးသွားတဲ့ ${t.P(m[1])} ပြန်မကောင်းတော့ဘူး`),
  rule(/^Add the food first$/, () => "အစားအစာ အရင် ထည့်"),
  rule(/^Empty hands to scrape it out$/, () => "ခြစ်ထုတ်ဖို့ လက်အလွတ် ဖြစ်ရမယ်"),
  rule(/^Chop the (.+) first$/, (m, t) => `${t.P(m[1])}ကို အရင် လှီး`),
  rule(/^Soup needs a bowl$/, () => "စွပ်ပြုတ်အတွက် ပန်းကန်လုံး လိုတယ်"),
  rule(/^Took (.+)$/, (m, t) => `${t.P(m[1])} ယူပြီ`),
  rule(/^Put back (.+)$/, (m, t) => `${t.P(m[1])} ပြန်ထားပြီ`),

  // ======================================================================== the game's own messages (main)
  rule(/^You are now the (.+)\.$/, (m, t) => `အခု ${t.P(m[1])} ဖြစ်သွားပြီ။`),
  rule(/^Kitchen open!$/, () => "မီးဖိုချောင် ဖွင့်ပြီ!"),
  rule(/^You are the (.+)\.$/, (m, t) => `${t.P(m[1])} ဖြစ်တယ်။`),
  rule(/^Solo kitchen open!$/, () => "တစ်ယောက်တည်း မီးဖိုချောင် ဖွင့်ပြီ!"),
  rule(/^Switch chefs from the menu\.$/, () => "စားဖိုမှူး ပြောင်းချင်ရင် မီနူးကနေ ပြောင်းပါ။"),
  rule(/^Press Q any time to hear what's around you\.$/, () => "ဘေးမှာ ဘာရှိလဲ ကြားချင်ရင် ဘယ်အချိန်မဆို Q နှိပ်ပါ။"),
  rule(/^New sticker: (.+)!$/, (m, t) => `စတစ်ကာ အသစ်: ${t.tr(m[1])}!`),
  rule(/^New sticker: (.+)$/, (m, t) => `စတစ်ကာ အသစ်: ${t.tr(m[1])}`),
  rule(/^Bought (.+)\.$/, (m, t) => `${t.tr(m[1])} ဝယ်ပြီးပြီ။`),
  rule(/^It's in place from your next shift\.$/, () => "နောက်အဆင့်ကစပြီး ရှိနေမယ်။"),
  rule(/^Daily special done!$/, () => "နေ့စဉ် အထူး ပြီးပြီ!"),
  rule(/^Plus (\d+) coins(?: for a (\d+)-day streak)?\.$/, (m) => `ဒင်္ဂါး +${m[1]}${m[2] ? ` (${m[2]} ရက် ဆက်တိုက်)` : ""}။`),
  rule(/^New best today: (\d+) points!$/, (m) => `ဒီနေ့ အကောင်းဆုံး အသစ်: ${m[1]} မှတ်!`),
  rule(/^New best on this level: (\d+) of 3 stars!$/, (m) => `ဒီအဆင့်မှာ အကောင်းဆုံး အသစ်: ကြယ် 3 ပွင့်မှာ ${m[1]} ပွင့်!`),
  rule(/^New high score on this level: (\d+)!$/, (m) => `ဒီအဆင့်မှာ အမှတ်အမြင့်ဆုံး အသစ်: ${m[1]}!`),
  rule(/^Warming up the kitchen (\d+)%$/, (m) => `မီးဖိုချောင် ပြင်ဆင်နေတယ် ${m[1]}%`),
  rule(/^There's no kitchen with the code (\w+)\.$/, (m) => `${m[1]} ကုဒ်နဲ့ မီးဖိုချောင် မရှိဘူး။`),
  rule(/^Someone is already the (.+)\.$/, (m, t) => `တစ်ယောက်က ${t.P(m[1])} ဖြစ်နေပြီ။`),

  // ======================================================================== the lobby and the setup
  rule(/^(\d+) \/ 3 chefs$/, (m) => `စားဖိုမှူး ${m[1]} / 3`),
  rule(/^Waiting for (.+) to pick a chef…$/, (m, t) => `${names(m[1], t)} စားဖိုမှူး ရွေးတာ စောင့်နေတယ်…`),
  rule(/^Waiting for (.+) \(host\) to start…$/, (m, t) => `${names(m[1], t)} (အိမ်ရှင်) စတာ စောင့်နေတယ်…`),
  rule(/^Today's shift: (.+) \((.+)\)$/, (m, t) => `ဒီနေ့ အဆင့်: ${t.tr(m[1])} (${t.tr(m[2])})`),
  rule(/^Finish with a star: \+(\d+) coins$/, (m) => `ကြယ်တစ်ပွင့်နဲ့ ပြီးရင် ဒင်္ဂါး +${m[1]}`),
  rule(/^Done today: best (\d+) points$/, (m) => `ဒီနေ့ ပြီးပြီ — အကောင်းဆုံး ${m[1]} မှတ်`),
  rule(/^(\d+)-day streak$/, (m) => `${m[1]} ရက် ဆက်တိုက်`),
  rule(/^best (\d+)$/, (m) => `အကောင်းဆုံး ${m[1]}`),
  rule(/^(\d+)\. (.+?)\s+([★☆]+)$/, (m, t) => `${m[1]}. ${t.tr(m[2])}  ${m[3]}`),
  rule(/^Shift (\d+), (.+), best (\d) of 3 stars$/, (m, t) => `အဆင့် ${m[1]}၊ ${t.tr(m[2])}၊ အကောင်းဆုံး ကြယ် 3 ပွင့်မှာ ${m[3]} ပွင့်`),
  rule(/^(\d+) of (\d+) stars$/, (m) => `ကြယ် ${m[2]} ပွင့်မှာ ${m[1]} ပွင့်`),
  rule(/^Locked: (.+)$/, (m, t) => `ဖွင့်ဖို့: ${m[1].split(" and ").map((need) => t.tr(need)).join("၊ ")}`),
  rule(/^sell (\d+) more coins$/, (m) => `ဒင်္ဂါး ${m[1]} ဖိုး ထပ်ရောင်း`),
  rule(/^clear (.+)$/, (m, t) => `${t.tr(m[1])} ကို ကျော်`),
  rule(/^(.+): (.+)\. Today's shift is (.+)\.$/, (m, t) => `${t.tr(m[1])}: ${t.tr(capital(m[2]))}။ ဒီနေ့ အဆင့်က ${t.tr(m[3])}။`),
  rule(/^Daily special · (.+)$/, (m, t) => `နေ့စဉ် အထူး · ${t.tr(m[1])}`),
  rule(/^Level (\d+) · (.+)$/, (m, t) => `အဆင့် ${m[1]} · ${t.tr(m[2])}`),

  // ======================================================================== the HUD, the end screen, the book
  rule(/^Till (\d+)$/, (m) => `ငွေ ${m[1]}`),
  rule(/^(.+) \+ (.+) on the tray$/, (m, t) => `${t.P(m[1])} + ဗန်းပေါ်မှာ ${t.P(m[2])}`),
  rule(/^(\d+) more points for the next star\.$/, (m) => `နောက်ကြယ်တစ်ပွင့်အတွက် နောက်ထပ် ${m[1]} မှတ်။`),
  rule(/^(.+): (\d) of 3 stars\.$/, (m, t) => `${t.tr(m[1])}: ကြယ် 3 ပွင့်မှာ ${m[2]} ပွင့်။`),
  rule(/^Next time: (.+)$/, (m, t) => `နောက်တစ်ခါ: ${t.tr(m[1])}`),
  rule(/^(.+) \((.+)\) is on this one$/, (m, t) => `${m[1]} (${t.P(m[2])}) က ဒါကို လုပ်နေတယ်`),
  rule(/^(\d+) (dish|dishes)$/, (m) => `ဟင်း ${m[1]} ပွဲ`),
  rule(/^Combo ×(\d+)$/, (m) => `ဆက်တိုက် ×${m[1]}`),
  rule(/^(\d+) raves?$/, (m) => `ချီးကျူးချက် ${m[1]} ခု`),
  rule(/^(\d+) walked out$/, (m) => `${m[1]} ယောက် ထွက်သွား`),
  rule(/^(\d+) got sick$/, (m) => `${m[1]} ယောက် နေမကောင်း`),
  rule(/^(\d+) fires?$/, (m) => `မီး ${m[1]} ခါ`),
  rule(/^(\d+) served$/, (m) => `${m[1]} ပွဲ ချခဲ့`),
  rule(/^(\d+) cooked perfectly$/, (m) => `${m[1]} ခု အကောင်းဆုံး ချက်ခဲ့`),
  rule(/^(\d+) chopped$/, (m) => `${m[1]} ခု လှီးခဲ့`),
  rule(/^charmed the tables (\d+) times$/, (m) => `စားပွဲတွေကို ${m[1]} ခါ ချော့ခဲ့`),
  rule(/^(\d+) signals$/, (m) => `အချက်ပြ ${m[1]} ခါ`),
  rule(/^(\d+) rung up$/, (m) => `${m[1]} ယောက် ငွေရှင်းပေးခဲ့`),
  rule(/^(\d+) handed over$/, (m) => `${m[1]} ခု လှမ်းပေးခဲ့`),
  rule(/^(\d+) coins$/, (m) => `ဒင်္ဂါး ${m[1]}`),
  rule(/^Collect (\d+) stickers to unlock it\.$/, (m) => `ဖွင့်ဖို့ စတစ်ကာ ${m[1]} ခု စုပါ။`),
  rule(/^(\d+) stickers$/, (m) => `စတစ်ကာ ${m[1]}`),
  rule(/^(\d+) new stickers$/, (m) => `စတစ်ကာ အသစ် ${m[1]} ခု`),
  rule(/^Hat colour (\d+)$/, (m) => `ဦးထုပ် အရောင် ${m[1]}`),
  rule(/^Stickers: (\d+) of (\d+)(?:, (\d+) new)?$/, (m) => `စတစ်ကာ: ${m[2]} ခုမှာ ${m[1]} ခု${m[3] ? `၊ အသစ် ${m[3]} ခု` : ""}`),
  rule(/^(.+?)\s+([★☆]+)$/, (m, t) => `${t.tr(m[1])}  ${m[2]}`),
  rule(/^(.+) · (\d+) dishes today$/, (m, t) => `${t.tr(m[1])} · ဒီနေ့ ဟင်း ${m[2]} မျိုး`),
  rule(/^(\d+) coins · served in a (plate|bowl)$/, (m, t) => `ဒင်္ဂါး ${m[1]} · ${vessel(m[2], t)}နဲ့ ပွဲချ`),
  rule(/^(\d+) × (.+)$/, (m, t) => `${t.P(m[2])} × ${m[1]}`),
  rule(/^at the (.+)$/, (m, t) => `${t.P(m[1])}မှာ`),
  rule(/^(.+): (\d+) dishes\. Pick one from the menu; ← → turns the page\.$/, (m, t) => `${t.tr(m[1])}: ဟင်း ${m[2]} မျိုး။ မီနူးက တစ်မျိုး ရွေးပါ — ← → စာမျက်နှာ လှန်။`),
  rule(/^Recipe book, (\d+) dishes\.$/, (m) => `ချက်နည်း စာအုပ်၊ ဟင်း ${m[1]} မျိုး။`),
  rule(/^(.+): (\d+) dishes\.$/, (m, t) => `${t.tr(m[1])}: ဟင်း ${m[2]} မျိုး။`),
  rule(/^Pick one from the menu; ← → turns the page\.$/, () => "မီနူးက တစ်မျိုး ရွေးပါ — ← → စာမျက်နှာ လှန်။"),
  // one recipe, read aloud: "Salad: tomato chopped; lettuce chopped, on one plate."
  rule(/^(.+): chop (.+), put all (\d+) in the soup pot, let it boil, then ladle it into a bowl\.$/, (m, t) =>
    `${t.P(m[1])}: ${t.P(m[2])}ကို လှီး၊ ${m[3]} ခုလုံး စွပ်ပြုတ်အိုးထဲ ထည့်၊ ဆူအောင် ချက်ပြီး ပန်းကန်လုံးထဲ ခပ်ထည့်ပါ။`),
  rule(/^(.+): (.+), on one plate\.$/, (m, t) => `${t.P(m[1])}: ${m[2].split("; ").map((item) => howTo(item, t)).join("၊ ")} — ပန်းကန်ပြား တစ်ချပ်ထဲ။`),
  rule(/^Finish (?:the plate|it) with (.+)\.$/, (m, t) => `${t.P(m[1])} ထည့်ပြီး အဆုံးသတ်ပါ။`),
  rule(/^(\d+) of (\d+)\.$/, (m) => `${m[2]} မှာ ${m[1]}။`),
  rule(/^The pot needs exactly (\d+) chopped vegetables\.$/, (m) => `အိုးထဲကို ဟင်းသီးဟင်းရွက်လှီး ${m[1]} ခု အတိအကျ လိုတယ်။`),
  rule(/^Bring a bowl as soon as it's boiled, before it burns\.$/, () => "ဆူပြီးတာနဲ့ မတူးခင် ပန်းကန်လုံး ယူလာပါ။"),
  rule(/^Season the (.+) before it goes in the pan, not after\.$/, (m, t) => `${t.P(m[1])}ကို ဒယ်အိုးထဲ မထည့်ခင် ဟင်းခတ်ပါ၊ ပြီးမှ မဟုတ်ဘူး။`),
  rule(/^Ask a friend to grab the (.+) while you cook\.$/, (m, t) => `ချက်နေတုန်း သူငယ်ချင်းကို ${t.P(m[1])} ယူပေးခိုင်းပါ။`),
  rule(/^The (.+) is done in (\d+)s and burns (\d+)s later\.$/, (m, t) => `${t.P(m[1])} ${m[2]} စက္ကန့်မှာ ကျက်ပြီး ${m[3]} စက္ကန့်နောက်မှာ တူးတယ်။`),
  rule(/^Call it out so someone's ready with a plate\.$/, () => "တစ်ယောက်ယောက် ပန်းကန်ပြား ကိုင်ပြီး အဆင်သင့် စောင့်နေအောင် အော်ပြောပါ။"),
  // the method: what to do with each thing (Burmese puts the verb after these, see recipeBook.ts)
  rule(/^the (.+) with (.+) first$/, (m, t) => `${t.P(m[1])}ကို ${t.P(m[2])} အရင်`),
  rule(/^the (.+) with (.+) once it's cooked$/, (m, t) => `ကျက်ပြီးရင် ${t.P(m[1])}ကို ${t.P(m[2])}`),
  rule(/^the (.+) for (\d+)s$/, (m, t) => `${t.P(m[1])}ကို ${m[2]} စက္ကန့်`),
  rule(/^the (.+) as it is$/, (m, t) => `${t.P(m[1])}ကို ဒီအတိုင်း`),
  rule(/^all (\d+) together$/, (m) => `${m[1]} ခုလုံး အတူတူ`),
  rule(/^it into a bowl$/, () => "ပန်းကန်လုံးထဲ"),
  rule(/^everything together$/, () => "အားလုံး အတူတူ"),
  rule(/^it$/, () => ""),
  rule(/^with (.+)$/, (m, t) => `${t.P(m[1])} ထည့်ပြီး`),
  rule(/^it at the pass$/, () => "ဟင်းထုတ်ကောင်တာမှာ"),
  rule(/^(\d+) (\w+?)e?s$/, (m, t) => `${t.P(m[2])} ${m[1]} ခုကို`),
  rule(/^the (.+)$/, (m, t) => `${t.P(m[1])}ကို`),
];

/** A note on a dish's seasoning, as the judging writes it. */
const NOTE = /^(too much |the .+ needed |no |it needed |they didn't want |.+ goe?s? on the )/i;

/**
 * Broad patterns ("… is ready", "Take …", "… handed … to …") go last, so the narrower ones about
 * the same words are tried first.
 */
const BROAD = new Set([
  "^Take (.+)$", "^Took (.+)$", "^Put back (.+)$", "^Pick up (.+)$", "^[Aa]dd (.+)$", "^Ladle (.+)$",
  "^Bought (.+)$", "^the (.+)$", "^with (.+)$", "^(\\d+) (\\w+?)e?s$", "^Added (.+)\\.$", "^Put (.+) on the (.+?)\\.$",
]);
const broad = ([pattern]: Rule) => pattern.source.startsWith("^(.+") || BROAD.has(pattern.source);
export const RULES: Rule[] = [...SPECIFIC.filter((r) => !broad(r)), ...SPECIFIC.filter(broad)];

/** A recipe step as the book reads it: "potato chopped, then fried" → "အာလူး — လှီးပြီး ကြော်". */
const STEP: Record<string, string> = { chopped: "လှီး", fried: "ကြော်", toasted: "ကင်", boiled: "ပြုတ်", cooked: "ချက်" };
function howTo(item: string, t: Tools): string {
  const m = item.match(/^(.+?) ((?:chopped|seasoned with|fried|toasted|boiled|cooked).*)$/);
  if (!m) return t.P(item);
  const steps = m[2].split(/, (?:then )?(?=chopped|seasoned with|fried|toasted|boiled|cooked)/).map((step) => {
    const season = step.match(/^seasoned with (.+)$/);
    return season ? `${t.P(season[1])} ခတ်` : (STEP[step] ?? t.tr(step));
  });
  const flow = steps.length > 1 ? `${steps.slice(0, -1).join("၊ ")}ပြီး ${steps.at(-1)}` : steps[0];
  return `${t.P(m[1])} — ${flow}`;
}

/** "Sam", "Sam and Alex", "you" → Burmese, with names kept. */
function names(list: string, t: Tools): string {
  const parts = list.split(/, | and /);
  const mine = parts.map((p) => (p === "you" ? "သင်" : p === "everyone" ? "အားလုံး" : p === "the host" ? "အိမ်ရှင်" : nm(p, t)));
  return mine.length > 1 ? `${mine.slice(0, -1).join("၊ ")}နဲ့ ${mine.at(-1)}` : mine[0];
}

const capital = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Verbs for the recipe book's method, said last in Burmese: "ခရမ်းချဉ်သီးကို လှီးပါ". */
export const METHOD_VERB: Record<string, string> = {
  Chop: "လှီးပါ",
  Boil: "ပြုတ်ပါ",
  Ladle: "ခပ်ထည့်ပါ",
  Season: "ဟင်းခတ်ပါ",
  Take: "ယူပါ",
  Plate: "ပန်းကန်ထဲ ထည့်ပါ",
  Finish: "အဆုံးသတ်ပါ",
  Serve: "ပွဲချပါ",
  Fry: "ကြော်ပါ",
  Toast: "ကင်ပါ",
  Cook: "ချက်ပါ",
};
