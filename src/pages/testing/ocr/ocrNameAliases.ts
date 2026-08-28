/**
 * OCR → kit display-name aliases for combat overlay parsing.
 *
 * Keys are lowercase alphanumeric only (spaces/punctuation stripped), matching
 * how `matchCharacterName` looks them up after `normalizeOcrName`.
 *
 * Includes every kit character (collapsed name + common OCR confusions) plus
 * hand-maintained short forms / observed misreads.
 */
export const OCR_NAME_ALIASES: Record<string, string> = {
  // Aino
  "aina": "Aino",
  "aino": "Aino",
  "alno": "Aino",
  // Albedo
  "albedo": "Albedo",
  // Alhaitham
  "alhaitham": "Alhaitham",
  "alhaithan": "Alhaitham",
  "alhaitharn": "Alhaitham",
  "alhaithem": "Alhaitham",
  // Aloy
  "aloy": "Aloy",
  // Alyosha
  "aliosha": "Alyosha",
  "alyosha": "Alyosha",
  // Amber
  "amber": "Amber",
  "arnber": "Amber",
  // Arataki Itto
  "arataki": "Arataki Itto",
  "aratakiitto": "Arataki Itto",
  "arataklltto": "Arataki Itto",
  "itto": "Arataki Itto",
  // Arlecchino
  "arle": "Arlecchino",
  "arlecchino": "Arlecchino",
  "arlecino": "Arlecchino",
  // Baizhu
  "baizhu": "Baizhu",
  "baizhuu": "Baizhu",
  // Barbara
  "barbara": "Barbara",
  // Beidou
  "beidou": "Beidou",
  // Bennett
  "bennett": "Bennett",
  // Candace
  "candace": "Candace",
  "candaoe": "Candace",
  // Charlotte
  "charlotte": "Charlotte",
  // Chasca
  "chasca": "Chasca",
  "chasoa": "Chasca",
  // Chevreuse
  "chevreus": "Chevreuse",
  "chevreuse": "Chevreuse",
  "chevreuze": "Chevreuse",
  // Chiori
  "chiori": "Chiori",
  "chlori": "Chiori",
  // Chongyun
  "chongyun": "Chongyun",
  // Citlali
  "citlali": "Citlali",
  "citlall": "Citlali",
  // Clorinde
  "clorinde": "Clorinde",
  "clorlnde": "Clorinde",
  "dorinde": "Clorinde",
  // Collei
  "coiiei": "Collei",
  "collei": "Collei",
  "collel": "Collei",
  // Columbina
  "columb1na": "Columbina",
  "columbina": "Columbina",
  "columblna": "Columbina",
  "columbna": "Columbina",
  "colurnbina": "Columbina",
  // Cyno
  "cyno": "Cyno",
  // Dahlia
  "dahlia": "Dahlia",
  // Dehya
  "dehya": "Dehya",
  // Diluc
  "diluc": "Diluc",
  // Diona
  "diona": "Diona",
  // Dori
  "dori": "Dori",
  // Durin
  "durin": "Durin",
  // Emilie
  "emilie": "Emilie",
  "emllie": "Emilie",
  "ernilie": "Emilie",
  // Escoffier
  "escoffier": "Escoffier",
  "escoffler": "Escoffier",
  // Eula
  "eula": "Eula",
  // Faruzan
  "faruzan": "Faruzan",
  "faruzarn": "Faruzan",
  // Fischl
  "fischl": "Fischl",
  // Flins
  "flins": "Flins",
  // Freminet
  "freminet": "Freminet",
  "fremlnet": "Freminet",
  "frerninet": "Freminet",
  // Furina
  "furina": "Furina",
  "furma": "Furina",
  // Gaming
  "gaming": "Gaming",
  "garning": "Gaming",
  // Ganyu
  "ganyu": "Ganyu",
  // Gorou
  "gorou": "Gorou",
  // Hu Tao
  "hutao": "Hu Tao",
  "tao": "Hu Tao",
  // Iansan
  "1ansan": "Iansan",
  "iansan": "Iansan",
  "lansan": "Iansan",
  // Ifa
  "1fa": "Ifa",
  "ifa": "Ifa",
  "lfa": "Ifa",
  // Illuga
  "1lluga": "Illuga",
  "iiiuga": "Illuga",
  "illuga": "Illuga",
  "llluga": "Illuga",
  // Ineffa
  "1neffa": "Ineffa",
  "ineffa": "Ineffa",
  "lneffa": "Ineffa",
  // Jahoda
  "jahoda": "Jahoda",
  // Jean
  "jean": "Jean",
  // Kachina
  "kachina": "Kachina",
  "kachlna": "Kachina",
  // Kaedehara Kazuha
  "kaedehara": "Kaedehara Kazuha",
  "kaedeharakazuha": "Kaedehara Kazuha",
  "kazua": "Kaedehara Kazuha",
  "kazuha": "Kaedehara Kazuha",
  // Kaeya
  "kaeya": "Kaeya",
  // Kamisato Ayaka
  "ayaka": "Kamisato Ayaka",
  "kamisatoayaka": "Kamisato Ayaka",
  "karnisatoayaka": "Kamisato Ayaka",
  // Kamisato Ayato
  "ayato": "Kamisato Ayato",
  "kamisatoayato": "Kamisato Ayato",
  "karnisatoayato": "Kamisato Ayato",
  // Kaveh
  "kaveh": "Kaveh",
  // Keqing
  "keqing": "Keqing",
  // Kinich
  "kinich": "Kinich",
  "kinlch": "Kinich",
  // Kirara
  "kirara": "Kirara",
  "klrara": "Kirara",
  // Klee
  "klee": "Klee",
  // Kujou Sara
  "kujou": "Kujou Sara",
  "kujousara": "Kujou Sara",
  "sara": "Kujou Sara",
  // Kuki Shinobu
  "kuki": "Kuki Shinobu",
  "kukishinobu": "Kuki Shinobu",
  "shinobu": "Kuki Shinobu",
  // Lan Yan
  "lan": "Lan Yan",
  "lanyan": "Lan Yan",
  "yan": "Lan Yan",
  // Lauma
  "lauma": "Lauma",
  "laurna": "Lauma",
  // Layla
  "layla": "Layla",
  // Linnea
  "linnea": "Linnea",
  // Lisa
  "lisa": "Lisa",
  // Lohen
  "lohen": "Lohen",
  // Lynette
  "lynette": "Lynette",
  // Lyney
  "lyney": "Lyney",
  // Manekin
  "manekin": "Manekin",
  "rnanekin": "Manekin",
  // Manekina
  "manekina": "Manekina",
  "rnanekina": "Manekina",
  // Mavuika
  "mavuika": "Mavuika",
  "mavulka": "Mavuika",
  "rnavuika": "Mavuika",
  // Mika
  "mika": "Mika",
  "rnika": "Mika",
  // Mona
  "mona": "Mona",
  "rnona": "Mona",
  // Mualani
  "mualani": "Mualani",
  "mualanl": "Mualani",
  "rnualani": "Mualani",
  // Nahida
  "nahida": "Nahida",
  "nahlda": "Nahida",
  // Navia
  "navia": "Navia",
  // Nefer
  "neer": "Nefer",
  "nef": "Nefer",
  "nefer": "Nefer",
  "net": "Nefer",
  // Neuvillette
  "neuv": "Neuvillette",
  "neuviiiette": "Neuvillette",
  "neuvilette": "Neuvillette",
  "neuvillete": "Neuvillette",
  "neuvillette": "Neuvillette",
  // Nicole
  "nicole": "Nicole",
  // Nilou
  "nilou": "Nilou",
  "nllou": "Nilou",
  // Ningguang
  "ningguang": "Ningguang",
  // Noelle
  "noeiie": "Noelle",
  "noelle": "Noelle",
  // Odette
  "odette": "Odette",
  "odete": "Odette",
  // Ororon
  "ororon": "Ororon",
  "orororn": "Ororon",
  // Prune
  "prune": "Prune",
  // Qiqi
  "qiqi": "Qiqi",
  // Raiden Shogun
  "raiden": "Raiden Shogun",
  "raidenshogun": "Raiden Shogun",
  "shogun": "Raiden Shogun",
  // Razor
  "razor": "Razor",
  // Rosaria
  "rosaria": "Rosaria",
  // Sandrone
  "sandrone": "Sandrone",
  // Sangonomiya Kokomi
  "kokomi": "Sangonomiya Kokomi",
  "kokoml": "Sangonomiya Kokomi",
  "sangonomiya": "Sangonomiya Kokomi",
  "sangonomiyakokomi": "Sangonomiya Kokomi",
  "sangonorniyakokomi": "Sangonomiya Kokomi",
  // Sayu
  "sayu": "Sayu",
  // Sethos
  "sethos": "Sethos",
  "sethoz": "Sethos",
  // Shenhe
  "shenhe": "Shenhe",
  // Shikanoin Heizou
  "heizou": "Shikanoin Heizou",
  "shikanoin": "Shikanoin Heizou",
  "shikanoinheizou": "Shikanoin Heizou",
  // Sigewinne
  "sigewine": "Sigewinne",
  "sigewinne": "Sigewinne",
  "slgewinne": "Sigewinne",
  // Skirk
  "skirk": "Skirk",
  "sklrk": "Skirk",
  // Sucrose
  "sicrose": "Sucrose",
  "sucrose": "Sucrose",
  "sucrosee": "Sucrose",
  // Tartaglia
  "tartaglia": "Tartaglia",
  // Thoma
  "thoma": "Thoma",
  "thorna": "Thoma",
  // Tighnari
  "tighnari": "Tighnari",
  "tighnarl": "Tighnari",
  // Traveler (Anemo)
  "traveleranemo": "Traveler (Anemo)",
  "traveleranerno": "Traveler (Anemo)",
  "travelleranemo": "Traveler (Anemo)",
  // Traveler (Cryo) — default for generic Traveler / Aether / Lumine
  "aether": "Traveler (Cryo)",
  "lumine": "Traveler (Cryo)",
  "traveler": "Traveler (Cryo)",
  "traveller": "Traveler (Cryo)",
  "travelercryo": "Traveler (Cryo)",
  "travellercryo": "Traveler (Cryo)",
  // Traveler (Dendro)
  "travelerdendro": "Traveler (Dendro)",
  "travellerdendro": "Traveler (Dendro)",
  // Traveler (Electro)
  "travelerelectro": "Traveler (Electro)",
  "travellerelectro": "Traveler (Electro)",
  // Traveler (Geo)
  "travelergeo": "Traveler (Geo)",
  "travellergeo": "Traveler (Geo)",
  // Traveler (Hydro)
  "travelerhydro": "Traveler (Hydro)",
  "travellerhydro": "Traveler (Hydro)",
  // Traveler (Pyro)
  "travelerpyro": "Traveler (Pyro)",
  "travellerpyro": "Traveler (Pyro)",
  // Varesa
  "varesa": "Varesa",
  // Varka
  "varka": "Varka",
  // Venti
  "venti": "Venti",
  // Wanderer
  "wanderer": "Wanderer",
  "wanderor": "Wanderer",
  // Wriothesley
  "wrioth": "Wriothesley",
  "wriotheslev": "Wriothesley",
  "wriothesley": "Wriothesley",
  "wriothesly": "Wriothesley",
  // Xiangling
  "xiangling": "Xiangling",
  "xiangllng": "Xiangling",
  // Xianyun
  "xianyun": "Xianyun",
  // Xiao
  "xiao": "Xiao",
  // Xilonen
  "xilonen": "Xilonen",
  "xilonern": "Xilonen",
  // Xingqiu
  "xingqiu": "Xingqiu",
  "xingqlu": "Xingqiu",
  // Xinyan
  "xinyan": "Xinyan",
  // Yae Miko
  "miko": "Yae Miko",
  "yae": "Yae Miko",
  "yaemiko": "Yae Miko",
  "yaerniko": "Yae Miko",
  // Yanfei
  "yanfei": "Yanfei",
  // Yaoyao
  "yaoyao": "Yaoyao",
  // Yelan
  "yeian": "Yelan",
  "yelan": "Yelan",
  "yelon": "Yelan",
  // Yoimiya
  "yoimiya": "Yoimiya",
  "yoirniya": "Yoimiya",
  // Yumemizuki Mizuki
  "mizuki": "Yumemizuki Mizuki",
  "yumemizuki": "Yumemizuki Mizuki",
  "yumemizukimizuki": "Yumemizuki Mizuki",
  "yurnemizukimizuki": "Yumemizuki Mizuki",
  // Yun Jin
  "yun": "Yun Jin",
  "yunjin": "Yun Jin",
  // Zhongli
  "zhongli": "Zhongli",
  "zhongll": "Zhongli",
  // Zibai
  "zibai": "Zibai",
}
