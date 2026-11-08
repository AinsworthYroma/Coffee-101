import AccordionGallery from './vendor/react-bits/AccordionGallery'
import { processingTopics } from './processing'

const photographs = {
  lave: { file: 'lavage.jpg', caption: 'Dépulpeuse et bac de lavage en Tanzanie.', author: 'Harald Ulver', source: 'https://commons.wikimedia.org/wiki/File:Coffee_Pulping_Machine_with_Washing_Tank_-_Tanzania.jpg', license: 'CC BY-SA 4.0' },
  nature: { file: 'nature.jpg', caption: 'Séchage naturel de cerises au Yémen.', author: 'Luai Al-Mamari', source: 'https://commons.wikimedia.org/wiki/File:Yemeni_Coffee_Natural_Processing.jpg', license: 'CC BY-SA 4.0' },
  honey: { file: 'pulpe.jpg', caption: 'Pulpe de café après traitement.', author: 'Ludger001', source: 'https://commons.wikimedia.org/wiki/File:Coffee_Processing_%E2%80%93_Discarded_pulp.jpg', license: 'CC BY-SA 4.0' },
  'wet-hulled': { file: 'flores.jpg', caption: 'Cerises de café au séchage à Flores, en Indonésie.', author: 'Josep M. Gracia', source: 'https://commons.wikimedia.org/wiki/File:WAE_-_Coffee_cherries_drying_in_Wae_Rebo,_Flores,_Indonesia,_2019.jpg', license: 'CC BY-SA 4.0' },
  fermentations: { file: 'cuves.jpg', caption: 'Tri des grains dans des cuves d’eau.', author: 'Ronchy~commonswiki', source: 'https://commons.wikimedia.org/wiki/File:Coffee_Processing_Seperation_vats.jpg', license: 'Domaine public' },
} as const

export default function ProcessingGallery({ onGuide }: { onGuide: (id: string) => void }) {
  return <>
    <AccordionGallery items={processingTopics.map(topic => ({ ...topic, subtitle: topic.id === 'fermentations' ? 'Une étape transversale' : topic.subtitle, caption: photographs[topic.id].caption, artwork: <img src={`/traitements/${photographs[topic.id].file}`} alt="" loading="lazy" /> }))} onGuide={onGuide} />
    <details className="gallery-credits"><summary>Crédits des photographies</summary><p>Photographies de contexte : elles ne représentent pas nécessairement le traitement présenté. Images recadrées à l’affichage.</p><ul>{Object.values(photographs).map(photo => <li key={photo.file}><a href={photo.source} target="_blank" rel="noreferrer">{photo.caption}</a> {photo.author} · {photo.license === 'Domaine public' ? photo.license : <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">{photo.license}</a>}</li>)}</ul></details>
  </>
}