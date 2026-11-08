export const processingTopics = [
  {
    id: 'lave', title: 'Lavé', subtitle: 'Washed',
    principle: 'La pulpe est retirée avant le séchage. Le mucilage restant autour du grain est éliminé, souvent avec une étape de fermentation, puis le café en parche est séché.',
    steps: 'Trier les cerises, dépulper, retirer le mucilage par fermentation et lavage ou par procédé mécanique, puis sécher avant le décorticage.',
    difference: 'Contrairement au nature, la cerise ne sèche pas entière ; contrairement au honey, on cherche à retirer le mucilage avant le séchage.',
    cup: 'Le résultat peut mettre en valeur une tasse nette et des notes acidulées, mais la variété, la récolte, le séchage et la torréfaction comptent aussi.',
    origin: 'Au Pérou, une étude menée à Alto Inambari compare notamment des lots lavés et naturels.',
    sources: ['peru'],
  },
  {
    id: 'nature', title: 'Nature', subtitle: 'Natural',
    principle: 'La cerise est séchée entière autour des grains, avant le retrait des couches extérieures.',
    steps: 'Trier les cerises, les sécher en surveillant régulièrement leur état, puis retirer la pulpe et la parche séchées.',
    difference: 'Le fruit reste autour du grain pendant le séchage, contrairement au lavé et au honey, où la pulpe est retirée auparavant.',
    cup: 'Des notes fruitées ou fermentaires peuvent apparaître ; elles ne sont ni systématiques ni propres à une origine.',
    origin: 'Des lots naturels ont été étudiés à Alto Inambari, au Pérou, aux côtés de lots lavés et honey.',
    sources: ['peru'],
  },
  {
    id: 'honey', title: 'Honey et pulped natural', subtitle: 'Dépulpé avec mucilage',
    principle: 'La pulpe est retirée, puis le grain sèche avec tout ou partie du mucilage encore présent autour de sa parche. Le nom honey ne signifie pas que du miel est ajouté.',
    steps: 'Trier et dépulper les cerises, conserver une partie du mucilage, sécher soigneusement, puis décortiquer la parche sèche.',
    difference: 'Le traitement se situe entre le lavé, où le mucilage est retiré avant séchage, et le nature, où la cerise reste entière. Les termes honey et pulped natural se recoupent, mais leur usage et la quantité de mucilage conservée varient selon les producteurs.',
    cup: 'Selon les lots et leur conduite, la tasse peut évoquer une douceur fruitée ou une texture plus ample ; aucun profil n’est garanti.',
    origin: 'Des lots honey ont notamment été comparés à d’autres traitements à Alto Inambari, au Pérou.',
    sources: ['honey', 'peru'],
  },
  {
    id: 'wet-hulled', title: 'Wet-hulled', subtitle: 'Giling basah',
    principle: 'Le café dépulpé commence à sécher en parche, mais cette enveloppe est retirée alors que le grain est encore humide. Le séchage se poursuit ensuite sur le grain décortiqué.',
    steps: 'Dépulper, retirer le mucilage selon la pratique locale, commencer le séchage en parche, décortiquer humide, puis finir le séchage.',
    difference: 'La différence décisive concerne le moment du décorticage : la parche est retirée avant le séchage complet, contrairement à un lavé séché en parche.',
    cup: 'Certains lots étudiés présentent du corps et des notes épicées ou terreuses. Ces observations ne décrivent pas tous les cafés traités ainsi.',
    origin: 'Le café Mandheling étudié autour du lac Toba, au nord de Sumatra en Indonésie, fournit un exemple documenté.',
    sources: ['sumatra'],
  },
  {
    id: 'fermentations', title: 'Fermentations particulières', subtitle: 'Dont l’anaérobie',
    principle: 'La fermentation décrit l’activité de micro-organismes et les conditions dans lesquelles elle se déroule ; ce n’est pas à elle seule une méthode de retrait du fruit. Une fermentation dite anaérobie est conduite avec un apport d’oxygène limité, souvent en récipient fermé.',
    steps: 'Selon le protocole, placer les cerises ou le café dépulpé dans un récipient, suivre la durée et les conditions, puis poursuivre le traitement et le séchage adaptés au lot.',
    difference: 'Une fermentation à oxygène limité peut accompagner différents traitements : elle ne remplace pas les distinctions entre lavé, nature et honey. Les pratiques et l’emploi du mot « anaérobie » varient.',
    cup: 'Elle peut modifier les composés aromatiques et donner des notes fruitées ou fermentaires, avec des résultats variables selon la durée, les microbes et le reste du procédé.',
    origin: 'À Gayo, en Indonésie, une étude a examiné des fermentations à oxygène limité sur des cafés non lavés.',
    sources: ['gayo'],
  },
] as const

export const processingSources: Record<string, { label: string; url: string }> = {
  peru: { label: 'Étude comparative, Alto Inambari, Pérou (2023)', url: 'https://doi.org/10.25186/.v18i.2111' },
  honey: { label: 'Pulped natural/honey coffee process (2024)', url: 'https://doi.org/10.1016/j.foohum.2024.100287' },
  sumatra: { label: 'Étude sur le café Mandheling, Sumatra (2005)', url: 'https://doi.org/10.22302/iccri.jur.pelitaperkebunan.v21i2.20' },
  gayo: { label: 'Fermentation de café Gayo, Indonésie (2021)', url: 'https://doi.org/10.22302/iccri.jur.pelitaperkebunan.v37i3.464' },
}