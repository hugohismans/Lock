import type { FeedbackRequest } from './haptics'

export type RoomId = 'arriere-boutique' | 'notaire' | 'chambre-forte'

export interface Level {
  id: number
  /** Chiffre romain de la carte narrative. */
  numeral: string
  title: string
  /** Nombre de chiffres de la combinaison. */
  digits: number
  /** Durée de la ronde, en millisecondes. Jamais affichée. */
  roundMs: number
  /** Ce que le niveau demande comme canal de feedback. */
  feedback: FeedbackRequest
  /** Fausses gorges par chiffre. 0 = aucun leurre. */
  decoysPerDigit: number
  /** Écran d'entraînement vraie/fausse gorge avant d'entrer. */
  training: boolean
  /** Le décor que le faisceau révèle. */
  room: RoomId
  /** Carte narrative d'entrée. Une phrase par ligne. */
  brief: readonly string[]
  /** Ce que je note en repartant. */
  success: readonly string[]
  /** Ce que je note en ne repartant pas. */
  failure: readonly string[]
}

/**
 * Les niveaux sont des données. Ajouter un niveau 4, c'est ajouter une entrée
 * dans ce tableau — rien d'autre.
 *
 * Niveaux 2 et 3 : pas encore construits. Le niveau 1 se joue de bout en bout
 * d'abord, et on règle le feel des crans avant d'aller plus loin.
 */
export const LEVELS: readonly Level[] = [
  {
    id: 1,
    numeral: 'I',
    title: "L'arrière-boutique",
    digits: 3,
    roundMs: 180_000,
    feedback: 'audible',
    decoysPerDigit: 0,
    training: false,
    room: 'arriere-boutique',
    brief: [
      "Un prêteur sur gages, rue des Vinaigriers. Le coffre a quarante ans et personne ne l’a jamais graissé.",
      'Trois chiffres. Le mécanisme est usé, il parle fort.',
      'Mets le son, ou un casque.'
    ],
    success: [
      "Deux cent quarante francs et une montre d’homme.",
      'Le prêteur ne déclarera rien. J’ai gardé la montre.'
    ],
    failure: ['La ronde est passée. Une autre fois.']
  }
]

/** La règle du geste, telle que je me la note. Affichée avant le premier niveau. */
export const RULE: readonly string[] = [
  'Je tourne dans un sens, lentement. Une gorge se sent : plus longue, plus grave que les crans. Trop vite, elle ne se sent pas.',
  'Je m’arrête dessus, je repars dans l’autre sens. Le chiffre est pris.',
  'Si j’inverse ailleurs, je perds ce chiffre et je le reprends.'
]

export function levelById(id: number): Level | undefined {
  return LEVELS.find((l) => l.id === id)
}
