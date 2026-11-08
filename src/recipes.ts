export type Method = 'automatic' | 'aeropress' | 'espresso' | 'filter'
export type FilterMode = 'electric' | 'v60'
export type Roast = 'unknown' | 'light' | 'medium' | 'dark'
export type Profile = 'round' | 'expressive'

export interface RecipeChoices {
  method: Method
  filterMode: FilterMode
  roast: Roast
  profile: Profile
  quantity: number
  basket: number
}

export interface Recipe {
  parameters: { label: string; value: string }[]
  steps: string[]
  assumptions: string[]
  adaptation: string[]
  adjustment: string
  result: string
  sources: { label: string; url: string }[]
}

export const initialChoices: RecipeChoices = {
  method: 'automatic', filterMode: 'electric', roast: 'unknown', profile: 'round', quantity: 250, basket: 18,
}

const roastAdvice: Record<Roast, string> = {
  unknown: 'Torréfaction inconnue : commence avec une base intermédiaire, sans supposer la couleur des grains.',
  light: 'Torréfaction claire : une eau un peu plus chaude peut favoriser l’extraction, si tu peux la régler.',
  medium: 'Torréfaction moyenne : la température intermédiaire est un point de départ.',
  dark: 'Torréfaction foncée : une eau un peu moins chaude peut limiter une amertume excessive, si tu peux la régler.',
}

const temperature: Record<Roast, number> = { unknown: 93, light: 96, medium: 93, dark: 90 }
const sources = {
  automatic: { label: 'SCA : préparation et matériel', url: 'https://sca.coffee/research/coffee-standards' },
  aeropress: { label: 'AeroPress : guide de préparation', url: 'https://aeropress.com/pages/how-to-use' },
  espresso: { label: 'Barista Hustle : le ratio espresso', url: 'https://www.baristahustle.com/espresso-recipes-understanding-yield/' },
  filter: { label: 'SCA : standards de préparation', url: 'https://sca.coffee/research/coffee-standards' },
  v60: { label: 'Hario : guides de préparation', url: 'https://www.hario-usa.com/pages/recipes-and-guides' },
}

export function makeRecipe(choices: RecipeChoices): Recipe {
  const { method, filterMode, roast, profile } = choices
  const expressive = profile === 'expressive'
  const profileAdvice = expressive
    ? 'Pour explorer davantage de nuances, ce point de départ privilégie une tasse un peu moins concentrée lorsque la méthode le permet.'
    : 'Pour une tasse plus enveloppante, ce point de départ privilégie une tasse un peu plus concentrée lorsque la méthode le permet.'
  if (method === 'automatic') {
    return {
      parameters: [{ label: 'Préparation', value: 'Un espresso avec ta machine à grains' }],
      steps: ['Remplis le réservoir avec de l’eau fraîche et ajoute les grains.', 'Prépare un espresso avec la commande habituelle de ta machine.', 'Goûte et note ce qui te plaît avant de changer quoi que ce soit.'],
      assumptions: ['Le modèle et ses réglages disponibles ne sont pas connus. Suis sa notice pour toute manipulation.'],
      adaptation: [roastAdvice[roast], 'Le profil choisi sert de repère de dégustation : sans connaître la machine, aucune dose, température ou mouture n’est prescrite.'],
      adjustment: 'Si ta machine le permet, consulte sa notice avant de modifier un réglage ; change une seule chose à la fois.',
      result: 'Une première tasse à goûter selon ton envie, sans garantie de résultat.', sources: [sources.automatic],
    }
  }
  if (method === 'espresso') {
    const dose = Math.max(14, Math.min(22, Math.round(choices.basket)))
    const ratio = expressive ? 2.2 : 2
    const yieldGrams = Math.round(dose * ratio)
    return {
      parameters: [{ label: 'Café sec', value: `${dose} g` }, { label: 'Boisson en tasse', value: `${yieldGrams} g` }, { label: 'Ratio café / boisson', value: `1 : ${ratio.toFixed(1).replace('.', ',')}` }, { label: 'Mouture', value: 'Fine, adaptée à ton moulin' }, { label: 'Durée indicative', value: 'Environ 25 à 35 s' }],
      steps: ['Mouds la dose adaptée à la capacité de ton panier.', 'Répartis la mouture et tasse-la régulièrement.', `Lance l’extraction et vise environ ${yieldGrams} g de boisson en tasse.`, 'Goûte ; le temps est un repère, pas une obligation.'],
      assumptions: ['Utilise la capacité indiquée pour ton panier ; la dose proposée doit lui correspondre.', 'La masse en tasse n’est pas la quantité d’eau versée.'],
      adaptation: [roastAdvice[roast], profileAdvice, 'Le ratio est une piste de départ ; il ne garantit pas les arômes du café.'],
      adjustment: 'Si la tasse est trop amère, essaie une mouture un peu plus grossière ; si elle est trop acide, essaie un peu plus fine.',
      result: 'Un espresso à ajuster selon le café et ton matériel.', sources: [sources.espresso],
    }
  }
  if (method === 'aeropress') {
    const water = 200
    const dose = expressive ? 12 : 14
    return {
      parameters: [{ label: 'Café', value: `${dose} g` }, { label: 'Eau versée', value: `${water} ml` }, { label: 'Ratio café / eau', value: `1 : ${(water / dose).toFixed(1).replace('.', ',')}` }, { label: 'Température indicative', value: `${temperature[roast]} °C` }, { label: 'Mouture', value: 'Moyenne-fine, proche du sel fin' }, { label: 'Durée indicative', value: 'Environ 2 min' }],
      steps: ['Place un filtre papier dans le porte-filtre et pose l’AeroPress sur une tasse solide.', `Ajoute ${dose} g de café, puis verse ${water} ml d’eau.`, 'Remue doucement, insère le piston et laisse infuser environ une minute.', 'Presse doucement pendant environ 30 secondes, sans forcer.'],
      assumptions: ['AeroPress Original de capacité standard, filtre papier et montage classique ; aucun accessoire Flow Control nécessaire.', 'Cette recette produit un café filtré ; un concentré façon espresso n’est pas un véritable espresso.'],
      adaptation: [roastAdvice[roast], profileAdvice, 'La dose varie ; l’eau reste sous la capacité supposée de l’appareil.'],
      adjustment: 'Trop amer ? Essaie une mouture un peu plus grossière ou une infusion plus courte. Trop léger ? Essaie un peu plus de café.',
      result: 'Une tasse filtrée à adapter à tes goûts.', sources: [sources.aeropress],
    }
  }
  const water = Math.max(250, Math.min(750, Math.round(choices.quantity / 50) * 50))
  const dose = Math.round(water * (expressive ? 0.06 : 0.065) * 10) / 10
  const modeName = filterMode === 'v60' ? 'V60 manuel' : 'Cafetière filtre électrique'
  return {
    parameters: [{ label: 'Méthode', value: modeName }, { label: 'Café', value: `${dose.toString().replace('.', ',')} g` }, { label: 'Eau versée', value: `${water} ml` }, { label: 'Ratio café / eau', value: `1 : ${(water / dose).toFixed(1).replace('.', ',')}` }, ...(filterMode === 'v60' ? [{ label: 'Température indicative', value: `${temperature[roast]} °C` }] : []), { label: 'Mouture', value: filterMode === 'v60' ? 'Moyenne, proche du sel de table' : 'Moyenne, adaptée au filtre de la machine' }, { label: 'Durée indicative', value: filterMode === 'v60' ? 'Environ 2 à 4 min' : 'Selon le cycle de la machine' }],
    steps: filterMode === 'v60'
      ? ['Place et rince le filtre papier, puis ajoute le café moulu.', `Verse doucement assez d’eau pour mouiller la mouture, attends environ 30 s, puis verse progressivement jusqu’à ${water} ml.`, 'Laisse l’eau s’écouler, retire le filtre et goûte.']
      : [`Place un filtre adapté et ajoute ${dose.toString().replace('.', ',')} g de café moulu.`, `Verse ${water} ml d’eau dans le réservoir, puis lance le cycle de la machine.`, 'Attends la fin du cycle avant de servir et de goûter.'],
    assumptions: ['Vérifie que la quantité choisie convient à la capacité et au volume minimal de ton équipement.'],
    adaptation: [filterMode === 'v60' ? roastAdvice[roast] : 'La machine contrôle généralement la température : la torréfaction ne modifie pas une commande supposée disponible.', profileAdvice, 'La base expressive utilise 60 g par litre ; la base ronde propose légèrement plus de café.'],
    adjustment: 'Trop amer ? Essaie une mouture un peu plus grossière. Trop léger ? Essaie un peu plus de café ou une mouture légèrement plus fine.',
    result: 'Une tasse filtre à ajuster selon le café et ton matériel.', sources: filterMode === 'v60' ? [sources.filter, sources.v60] : [sources.filter],
  }
}