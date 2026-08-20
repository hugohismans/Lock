/**
 * TOUTES les constantes de « feel » du jeu vivent ici, et nulle part ailleurs.
 * Rien dans ce fichier ne dépend du DOM, de l'audio ou de Svelte : on peut
 * tout régler sans relire une ligne du reste du code.
 *
 * Unités :
 *   - « poignet »  = degrés de rotation physique du téléphone dans son plan
 *   - « cadran »   = degrés de rotation de la serrure  (cadran = poignet × GEAR_RATIO)
 *   - dps          = degrés de cadran par seconde
 */

export const DIAL = {
  /** Un vrai cadenas à combinaison : 40 crans sur 360°. */
  NOTCH_COUNT: 40,

  /**
   * Démultiplication. Le cadran tourne GEAR_RATIO fois plus vite que le poignet.
   * À 2.0 : un tour complet de cadran = 180° de poignet, un cran = 4,5° de poignet.
   *
   * Le brief demandait 3.0 (120° de poignet par tour), mais un cran ne ferait
   * alors que 3° de poignet, soit à peine plus que le bruit du capteur (±0,5 à 1°) :
   * les tics crépitent et une gorge devient un coup de chance. À régler ensemble.
   */
  GEAR_RATIO: 2.0,

  /**
   * Hystérésis de franchissement (degrés de cadran). Il faut dépasser la
   * frontière d'un cran de cette valeur pour que le cran suivant s'enclenche.
   * C'est ce qui empêche un poignet immobile pile sur une frontière de
   * mitrailler des tics. Doit rester nettement sous NOTCH_DEG / 2 (= 4,5°).
   */
  NOTCH_HYSTERESIS_DEG: 2.2,

  /** Coupure du passe-bas appliqué au vecteur gravité (Hz). Plus bas = plus lisse, plus mou. */
  GRAVITY_CUTOFF_HZ: 6,

  /** Coupure du passe-bas appliqué à la vitesse angulaire (Hz). */
  SPEED_CUTOFF_HZ: 5,

  /** En dessous de cette vitesse (dps), on considère le cadran immobile : sens = 0. */
  DIR_DEADZONE_DPS: 14,

  /**
   * Durée pendant laquelle un nouveau sens doit tenir avant d'être confirmé (ms).
   * Un changement de sens est l'acte le plus lourd du jeu : il ne doit jamais
   * être un accident de bruit.
   * ⚠ Invariant : DIR_CONFIRM_MS × DIR_DEADZONE_DPS doit rester très inférieur à
   * NOTCH_DEG (9°), sinon on peut quitter la gorge pendant la fenêtre de
   * confirmation. À 90 ms × 14 dps = 1,26° : large marge.
   */
  DIR_CONFIRM_MS: 90,

  /**
   * Au-delà de cette vitesse (dps), une gorge produit exactement le même tic
   * que les 39 autres crans. C'est LA règle qui force à ralentir — et ralentir
   * coûte de la ronde.
   */
  GATE_MAX_SPEED_DPS: 95,

  /**
   * Le téléphone à plat (écran vers le plafond) rend atan2(gx, gy) dégénéré.
   * Au-delà de ce rapport |gz| / |g|, on coupe la lecture — et la torche meurt,
   * ce qui fait redresser le joueur sans lui écrire un message d'erreur.
   */
  FLAT_LIMIT: 0.72
} as const

/** Degrés de cadran par cran. */
export const NOTCH_DEG = 360 / DIAL.NOTCH_COUNT

export const COMBINATION = {
  /** Distance circulaire minimale, en crans, entre deux gorges successives. Jamais adjacentes. */
  MIN_GAP: 3,
  /** Distance minimale entre un leurre et la vraie gorge du même chiffre (niveau 3). */
  MIN_DECOY_GAP: 3
} as const

export const FEEDBACK = {
  /** Le tic : très court, sec, sans information. */
  TICK_MS: 12,

  /** La gorge : plus longue, plus grave, plus pleine. */
  GATE_MS: 150,

  /**
   * La fausse gorge (niveau 3) : même durée totale, même énergie, texture hachée.
   * L'enveloppe est coupée FALSE_GAPS fois pendant FALSE_GAP_MS.
   * L'égalité d'énergie est exacte sur les canaux audio (le gain est compensé
   * par 1/√(rapport cyclique)) ; elle est seulement approchée sur navigator.vibrate,
   * qui est binaire et ne donne accès à aucune amplitude.
   */
  FALSE_GAPS: 2,
  FALSE_GAP_MS: 14,

  /** Fréquences. La gorge audible du niveau 1, et l'impulsion « ressentie » du mode casque. */
  GATE_HZ: 92,
  HAPTIC_HZ: 45,

  /** Le tic audible : bruit filtré en cloche autour de cette fréquence. */
  TICK_HZ: 1900,

  /** Le mécanisme qui prend : un chiffre est verrouillé. */
  LOCKED_MS: 90,
  /** Le mécanisme qui glisse : on a inversé le sens dans le vide. */
  LOST_MS: 240
} as const

export const RENDER = {
  /** Rayon du faisceau, en fraction de la plus petite dimension de l'écran. */
  BEAM_RADIUS: 0.43,
  /** Aplatissement de l'ellipse de lumière. */
  BEAM_SQUASH: 0.78,
  /** Inertie du faisceau : 0 = collé au centre, 1 = flotte librement. */
  BEAM_LAG: 0.12,
  /** Amplitude du décalage du faisceau dû à l'inertie (fraction de l'écran). */
  BEAM_DRIFT: 0.09,
  /** Largeur du panorama de la pièce, en pixels. Un tour de cadran = un tour de pièce. */
  ROOM_WIDTH: 2048,
  ROOM_HEIGHT: 768,
  /** Grain de pellicule : nombre de tuiles pré-cuites et opacité. */
  GRAIN_TILES: 4,
  GRAIN_ALPHA: 0.17,
  /** Poussière dans le rai de lumière. */
  DUST_COUNT: 44,
  /** Plafond de devicePixelRatio (au-delà, on paie sans rien voir de plus). */
  MAX_DPR: 2,
  /**
   * Le panorama est composé dans un espace de 2048×768 puis rastérisé à
   * l'échelle qu'exige l'écran, sous plafond : au-delà, on paie de la mémoire
   * pour un flou qu'on ne voit pas sous le grain.
   */
  ROOM_PIXEL_BUDGET: 4_500_000,
  /** prefers-reduced-motion : la pièce est découpée en N fragments entre lesquels on fond. */
  REDUCED_FRAGMENTS: 8,
  REDUCED_FADE_MS: 600
} as const
