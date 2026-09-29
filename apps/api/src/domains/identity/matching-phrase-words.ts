// The closed word lists of the matching phrase (docs/mvp/05 RG128 to RG134, CA73). They are the
// lists of 05, copied as is: a word changes only by replacing it with another one that meets
// RG133, in code review, the total staying 256 (RG134). Tests: tests/matching-phrase.test.ts.
import type { UiLocale } from "@influx/contracts/auth";

// prettier-ignore
const FRENCH = [
  // 3 letters
  "île", "jus", "lac", "mer", "nid", "riz", "ski", "thé",
  // 4 letters
  "baie", "café", "cerf", "chou", "ciel", "élan", "gant", "gare", "houx", "iris", "judo", "lait",
  "lion", "loup", "lune", "moto", "ours", "pont", "quai", "seau", "surf", "thym", "tour", "vélo",
  // 5 letters
  "aigle", "ancre", "arbre", "astre", "banjo", "bison", "botte", "brume", "bulle", "canoë",
  "cèdre", "chêne", "crabe", "crêpe", "cygne", "danse", "datte", "étang", "figue", "fleur",
  "flûte", "forêt", "fusée", "galet", "genêt", "givre", "glace", "globe", "hamac", "harpe",
  "héron", "hibou", "igloo", "koala", "lampe", "lilas", "merle", "morse", "neige", "nuage",
  "oasis", "olive", "opéra", "orque", "panda", "pêche", "phare", "piano", "plage", "pluie",
  "poney", "puits", "récif", "robot", "rosée", "ruban", "salsa", "sapin", "saule", "sirop",
  "soupe", "stade", "stylo", "tango", "tasse", "tente", "tigre", "train", "zèbre",
  // 6 letters
  "acacia", "aimant", "alpaga", "ananas", "aurore", "aviron", "ballon", "bambou", "barque",
  "bateau", "bélier", "bleuet", "bonnet", "bougie", "cabane", "cactus", "cahier", "canard",
  "canyon", "carnet", "cerise", "chaise", "chalet", "cheval", "chèvre", "cirque", "comète",
  "corail", "crayon", "dahlia", "désert", "éclair", "érable", "étoile", "faucon", "flèche",
  "fraise", "gaufre", "girafe", "graine", "grange", "grotte", "homard", "jardin", "jasmin",
  "lagune", "lézard", "lierre", "loutre", "mangue", "marais", "méduse", "menthe", "mimosa",
  "miroir", "mousse", "mouton", "muguet", "navire", "oignon", "otarie", "oursin", "persil",
  "pétale", "pinson", "plaine", "racine", "radeau", "raisin", "renard", "roseau", "ruelle",
  "salade", "saumon", "soleil", "sommet", "sorbet", "source", "tennis", "tomate", "tortue",
  "toucan", "trèfle", "tricot", "truite", "tulipe", "valise", "vallée", "verger", "violon",
  "volcan", "yaourt",
  // 7 letters
  "abeille", "abricot", "armoire", "atelier", "basilic", "biscuit", "bosquet", "bouleau",
  "brioche", "caillou", "camélia", "caramel", "cascade", "chapeau", "colibri", "colline",
  "criquet", "dauphin", "échelle", "écharpe", "étagère", "falaise", "fenêtre", "ficelle",
  "flamant", "fougère", "fromage", "gazelle", "glacier", "grillon", "guépard", "guitare",
  "horloge", "lavande", "luciole", "marelle", "moineau", "mouette", "olivier", "palmier",
  "parasol", "pélican", "pieuvre", "pinceau", "piscine", "pivoine", "planète", "poireau",
  "poisson", "poivron", "potager", "prairie", "praline", "rivière", "sandale", "sardine",
  "sifflet", "tambour", "taureau", "théâtre", "vanille", "village", "voilier",
] as const;

// prettier-ignore
const ENGLISH = [
  // 3 letters
  "bay", "bee", "dew", "egg", "elk", "fog", "hat", "ivy", "jar", "map", "oak", "owl", "sky",
  "sun", "tea",
  // 4 letters
  "barn", "bear", "bell", "boat", "cape", "cove", "dawn", "deer", "drum", "duck", "dune", "fern",
  "fork", "gate", "harp", "hawk", "hill", "hive", "iris", "jazz", "kite", "lake", "lamp", "leaf",
  "lily", "milk", "mist", "moon", "moss", "park", "peak", "pier", "pond", "raft", "rain", "reef",
  "rice", "rock", "sage", "salt", "sled", "soup", "star", "surf", "swan", "tent", "tree", "tuba",
  "wave", "wolf",
  // 5 letters
  "acorn", "banjo", "basil", "birch", "bison", "bloom", "brook", "brush", "cabin", "canoe",
  "cedar", "cello", "chair", "chess", "cliff", "clock", "cloud", "comet", "coral", "crane",
  "daisy", "eagle", "field", "finch", "flute", "frost", "globe", "grove", "hazel", "heron",
  "holly", "igloo", "jelly", "koala", "lilac", "maple", "moose", "ocean", "olive", "onion",
  "otter", "paint", "panda", "paper", "pasta", "peony", "petal", "piano", "pizza", "radio",
  "raven", "river", "robin", "robot", "salad", "salsa", "scarf", "shelf", "shrub", "skate",
  "syrup", "table", "tango", "tiger", "toast", "tower", "tulip", "wagon", "waltz", "zebra",
  // 6 letters
  "almond", "alpaca", "anchor", "aurora", "ballet", "bamboo", "breeze", "bridge", "butter",
  "cactus", "canary", "candle", "canyon", "carpet", "castle", "chalet", "cheese", "circus",
  "clover", "coffee", "crayon", "dahlia", "desert", "falcon", "forest", "garden", "garlic",
  "guitar", "hiking", "hockey", "island", "karate", "kettle", "kitten", "ladder", "lagoon",
  "lizard", "magnet", "marble", "meadow", "meteor", "mirror", "museum", "noodle", "orchid",
  "oyster", "papaya", "parrot", "pencil", "planet", "potato", "puffin", "rabbit", "ribbon",
  "rocket", "salmon", "sandal", "sleigh", "sorbet", "spider", "sprout", "squash", "summit",
  "teapot", "tennis", "tomato", "toucan", "turtle", "valley", "violet", "violin", "waffle",
  "walnut", "walrus", "willow",
  // 7 letters
  "apricot", "avocado", "balloon", "bicycle", "blanket", "bowling", "caramel", "compass",
  "cottage", "cricket", "curtain", "cushion", "custard", "dolphin", "feather", "firefly",
  "gazelle", "giraffe", "glacier", "harvest", "horizon", "jasmine", "lantern", "leopard",
  "lettuce", "library", "lobster", "orchard", "pancake", "parsley", "pelican", "popcorn",
  "prairie", "pretzel", "pudding", "pumpkin", "rainbow", "scooter", "seagull", "seaside",
  "sparrow", "stadium", "sunrise", "thunder", "vanilla", "volcano",
] as const;

export const MATCHING_PHRASE_WORDS: Readonly<
  Record<UiLocale, readonly string[]>
> = {
  fr: FRENCH,
  en: ENGLISH,
};
