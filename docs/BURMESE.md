# Chet Mal in Burmese (မြန်မာ)

How the Burmese version is written, the words it uses and why, and how to change them. A native
speaker should read the [words to check](#words-to-check) first.

## How it works

The game writes English everywhere (the rules, the coach, the server); each player's game shows it
in their language as it appears. So one online kitchen can have a Burmese and an English player.

- `client/src/i18n/my/ui.ts`: every fixed string (menus, settings, levels, stickers…), English → Burmese.
- `client/src/i18n/my/rules.ts`: sentences built from pieces ("Took a raw tomato from the fridge."),
  one pattern each, rewritten in Burmese order (verb last, ကို after the object).
- `client/src/i18n/my/terms.ts`: food in every state, dishes, spices, stations and roles. Food
  and dishes are generated from the game's data: a new ingredient only needs its Burmese name.
- `client/src/i18n/dom.ts`: shows the page in Burmese, including whatever the game writes later.

Players choose in **Settings → Language**, or with the language switch on the title screen. A
browser set to Burmese starts in Burmese, and `?lang=my` in a link does too (and remembers it).

**Check it:** `npm run test:burmese` plays every shift with every crew and translates all it hears
(about 4,300 different texts). It fails and lists the English if a new message has no Burmese.

## Style

- **Everyday spoken Burmese** (အပြောစကား), short and warm, like talking in a kitchen:
  `-တယ်`, `-ပြီ`, `-မယ်`, `-ပါ`, `-နော်`. No written style (`-သည်`, `-မည်`, `၏`, `၌`).
- **Instructions end in ပါ** ("ခရမ်းချဉ်သီး ယူပါ"). **Buttons and hints are bare verbs**, like phone
  apps: "ယူ", "ချ", "ပွဲချ!", "လွှင့်ပစ်".
- **"You"**: Burmese drops it; the game almost never needs it. Where a label must say it (the
  badge on your chef, "You" on the end screen), it's **သင်**, as in Burmese phone apps. Never မင်း.
- **Numbers stay 0–9**, like the score, the clock and the number keys. (Change in one place if you'd rather use ၀–၉.)
- **Full stop ။, list comma ၊**; "!" and "?" as in casual Burmese writing.
- **Keys stay Latin**: F, R, G, B, T, Space, Enter, Shift.
- **Lists**: "A၊ B နဲ့ C". Never two နဲ့ in one list (so "finish with salt and lemon" is
  "ဆားနဲ့ လီမွန်သီး ထည့်ပြီး အဆုံးသတ်ပါ", not "…နဲ့ အဆုံးသတ်").
- **Food as Burmese recipes name it**: noun + cut/cooking — ခရမ်းချဉ်သီး**လှီး** (sliced tomato),
  ငါး**တုံး** (fish pieces), ပေါင်မုန့်**ချပ်** (bread slices), ပေါင်မုန့်**ကင်** (toast),
  ကြက်ဥ**ကြော်** (fried egg). Raw food is just its name: nobody says "raw tomato" in Burmese.
  Generic cooked/burnt: "ကျက်ပြီးသား …", "တူးသွားတဲ့ …".

## The words

### Kitchen

| English | Burmese | Why |
|---|---|---|
| kitchen | မီးဖိုချောင် | |
| counter | ကောင်တာ | everyday loanword |
| cutting board | စဉ်းတီတုံး | |
| stove | မီးဖို | |
| pan | ဒယ်အိုး | |
| soup pot | စွပ်ပြုတ်အိုး | |
| the pass | ဟင်းထုတ်ကောင်တာ | "where the food goes out" |
| sink | ဘေစင် | what people say at home |
| bin | အမှိုက်ပုံး | |
| fridge | ရေခဲသေတ္တာ | |
| shelf | စင် | |
| spice rack / topping rack | ဟင်းခတ်စင် / အဆာပလာစင် | အဆာပလာ: what goes on mohinga and noodles |
| till | ငွေရှင်းကောင်တာ | |
| dirty dish counter | ပန်းကန်ညစ်ကောင်တာ | |
| plate / bowl | ပန်းကန်ပြား / ပန်းကန်လုံး | |
| tray | ဗန်း | |
| booster seat | ကလေးထိုင်ခုံ | |

### Doing things

| English | Burmese |
|---|---|
| chop | လှီး |
| cook / fry / grill / boil | ချက် / ကြော် / ကင် / ပြုတ် |
| season / seasoning | ဟင်းခတ် |
| plate it | ပန်းကန်ပြားပေါ် တင် / ပန်းကန်ထဲ ထည့် |
| serve | ပွဲချ (what Burmese restaurants say) |
| ladle | ခပ်ထည့် |
| wash up | ပန်းကန်ဆေး |
| mop | သုတ် |
| put out a fire | မီးငြိမ်း |
| burnt | တူး |
| gone off / mouldy | ပုပ် / မှိုတက် |
| sniff | အနံ့ခံ |
| hold (the button) | ဖိထား |

### The game

| English | Burmese | Why |
|---|---|---|
| order / ticket / phone order | အော်ဒါ / အော်ဒါစာရွက် / ဖုန်းအော်ဒါ | အော်ဒါ is what every Myanmar restaurant says |
| customer | ဧည့်သည် | |
| food critic | ဝေဖန်ရေးဆရာ | |
| shift, level | အဆင့် | one word for both, as games say |
| rush hour | လူစည်ချိန် | |
| combo | ဆက်တိုက် | |
| perfect | အကောင်းဆုံး | |
| just right | အနေတော် | |
| power cut | မီးပျက် | what everyone in Myanmar calls it |
| storm | မုန်တိုင်း | |
| overtime | အချိန်ပို | |
| coins / points / stars | ဒင်္ဂါး / အမှတ် / ကြယ် | |
| daily special | နေ့စဉ် အထူး | |
| tutorial | သင်ခန်းစာ | |
| host (of a room) | အိမ်ရှင် | |
| ping / bell / signs | ညွှန်ပြ / ခေါင်းလောင်း / လက်ဟန် | |
| take a hand | လက်ဆွဲ | |
| helper bot | အကူစက်ရုပ် | |
| street food stand | လမ်းဘေးစာဆိုင် | |

### The chefs

Respectful, plain words for disability; never နားပင်း or ဆွံ့အ.

| English | Burmese |
|---|---|
| head chef | စားဖိုမှူးချုပ် |
| deaf chef | နားမကြားတဲ့ စားဖိုမှူး |
| mute chef | စကားမပြောနိုင်တဲ့ စားဖိုမှူး |
| all senses (solo) | အာရုံအားလုံး (တစ်ယောက်တည်း) |

### Food and dishes

Burmese dishes keep their own names: မုန့်ဟင်းခါး, လက်ဖက်သုပ်, ရှမ်းခေါက်ဆွဲ,
ကြက်သားဟင်းနဲ့ ထမင်း, မြန်မာ ထမင်းကြော်. The others are written the way a Yangon menu would:
ဆလတ်သုပ်, ငါးကင်, အမဲသားကင်နဲ့ အာလူးချောင်းကြော်, ငါးကြော်နဲ့ အာလူးချောင်းကြော်,
ခရမ်းချဉ်သီး စွပ်ပြုတ်… Seasonings: ဆား, ငရုတ်ကောင်း, ပဲငံပြာရည်, ငံပြာရည်, နနွင်း, နံနံပင်,
မြေပဲထောင်း, ကြက်သွန်ဖြူကြော်ဆီ, ငရုတ်သီးမှုန့်, ရှာလကာရည်, သံလွင်ဆီ, ထောပတ်.

## Words to check

These are the choices a native speaker should confirm or change (each is one line in the files above):

1. **the pass → ဟင်းထုတ်ကောင်တာ.** Restaurants may have their own word for it.
2. **lemon → လီမွန်သီး, lime → သံပုရာသီး.** Kept apart because the street stand has lemons and
   the tea shop limes; many people say သံပုရာ for both.
3. **fresh herbs → အမွှေးရွက်.** Could be "ဟင်းခတ်အရွက်" or just နံနံပင်.
4. **combo → ဆက်တိုက်**, **rush hour → လူစည်ချိန်**: or the loanwords players may expect (ကွန်ဘို).
5. **shift and level → both အဆင့်**: or ဆိုင်း for shift.
6. **room host → အိမ်ရှင်**: or ဦးဆောင်သူ.
7. **"you" → သင်** on the few labels that need it.
8. **Western dish names**: "ပဲငံပြာရည် ငါးကြော်" (soy-glazed fish), "မနက်စာ အပြည့်အစုံ" (full
   breakfast), "မှိုနဲ့ ကြက်သွန် ကြော်" (mushroom stir-fry).
9. **Level names**: "မုန့်ဟင်းခါး တနင်္လာ" (Mohinga Monday), "ပုပ်တဲ့ အသုတ်" (Bad batch),
   "ဟင်းဆိုင်" (Curry house).

## Reading aloud

Read aloud and the phone orders use a Burmese voice where the device has one (many don't yet).
Without one they stay in English, so a phone order is still heard.

## The font

Burmese uses Noto Sans Myanmar, loaded only in Burmese. Older phones whose own font is the old
Zawgyi encoding would otherwise garble standard Unicode text. Lines are a little taller in Burmese
for the marks above and below, and short labels don't break between syllables.
