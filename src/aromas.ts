export interface AromaNode {
  id: string
  label: string
  children?: AromaNode[]
}

// Vocabulaire original provisoire, indépendant de toute roue officielle.
export const aromaVersion = 1
export const aromas: AromaNode[] = [
  { id: 'fruite', label: 'Fruité', children: [
    { id: 'agrumes', label: 'Agrumes', children: [{ id: 'citron', label: 'Citron' }, { id: 'orange', label: 'Orange' }, { id: 'pamplemousse', label: 'Pamplemousse' }] },
    { id: 'baies', label: 'Baies', children: [{ id: 'fraise', label: 'Fraise' }, { id: 'framboise', label: 'Framboise' }, { id: 'myrtille', label: 'Myrtille' }] },
    { id: 'autres-fruits', label: 'Autres fruits', children: [{ id: 'pomme', label: 'Pomme' }, { id: 'peche', label: 'Pêche' }, { id: 'raisin', label: 'Raisin' }] },
  ] },
  { id: 'floral', label: 'Floral', children: [{ id: 'fleurs', label: 'Fleurs', children: [{ id: 'rose', label: 'Rose' }, { id: 'jasmin', label: 'Jasmin' }, { id: 'camomille', label: 'Camomille' }] }] },
  { id: 'sucre', label: 'Sucré', children: [{ id: 'sucres', label: 'Sucres', children: [{ id: 'caramel', label: 'Caramel' }, { id: 'miel', label: 'Miel' }, { id: 'vanille', label: 'Vanille' }] }] },
  { id: 'cacao-noix', label: 'Cacao et fruits à coque', children: [{ id: 'cacao', label: 'Cacao', children: [{ id: 'chocolat', label: 'Chocolat' }, { id: 'chocolat-noir', label: 'Chocolat noir' }] }, { id: 'noix', label: 'Fruits à coque', children: [{ id: 'amande', label: 'Amande' }, { id: 'noisette', label: 'Noisette' }] }] },
  { id: 'epice', label: 'Épicé', children: [{ id: 'epices', label: 'Épices', children: [{ id: 'cannelle', label: 'Cannelle' }, { id: 'girofle', label: 'Clou de girofle' }, { id: 'poivre', label: 'Poivre' }] }] },
  { id: 'grille', label: 'Grillé', children: [{ id: 'torréfie', label: 'Torréfié', children: [{ id: 'fumee', label: 'Fumée' }, { id: 'cendre', label: 'Cendre' }, { id: 'brule', label: 'Brûlé' }] }] },
  { id: 'vegetal', label: 'Végétal', children: [{ id: 'vert', label: 'Vert', children: [{ id: 'herbe', label: 'Herbe' }, { id: 'foin', label: 'Foin' }, { id: 'pois', label: 'Petit pois' }] }] },
  { id: 'fermente', label: 'Acide et fermenté', children: [{ id: 'acidule', label: 'Acidulé', children: [{ id: 'vinaigre', label: 'Vinaigre' }, { id: 'lactique', label: 'Lactique' }] }, { id: 'fermentation', label: 'Fermenté', children: [{ id: 'vin', label: 'Vin' }, { id: 'fruit-fermente', label: 'Fruit fermenté' }] }] },
  { id: 'autres', label: 'Autres impressions', children: [{ id: 'papier-moisi', label: 'Papier et moisi', children: [{ id: 'papier', label: 'Papier' }, { id: 'carton', label: 'Carton' }, { id: 'moisi', label: 'Moisi' }] }, { id: 'chimique', label: 'Chimique', children: [{ id: 'caoutchouc', label: 'Caoutchouc' }, { id: 'medicinal', label: 'Médicinal' }] }] },
]
