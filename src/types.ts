export type PlayerId = string;
export type RoomCode = string;
export type HeroId = 'sutha' | 'azzan' | 'lia' | 'oriax' | 'minsc' | 'jaheira';
export type GameStatus = 'lobby' | 'rolling' | 'playing' | 'finishing' | 'finished';
export type GameMode = 'classic' | 'remix';
export type TurnPhase = 'drawing' | 'playing' | null;

export type SymbolType =
  | 'attack'
  | 'shield'
  | 'heal'
  | 'draw'
  | 'play_again'
  | 'mighty'
  | 'reclaim';

export type TargetType = 'self' | 'opponent' | 'all' | 'all_opponents';

export interface CardSymbol {
  type: SymbolType;
  value?: number | string;
  target?: TargetType;
  effect?: string;
}

export interface CardDefinition {
  id: string;
  heroId: HeroId;
  name: string;
  count: number;
  symbols: CardSymbol[];
  description?: string;
  formBonus?: Partial<Record<'bear' | 'wolf', CardSymbol[]>>;
  requiresForm?: 'bear' | 'wolf';
}

export interface HeroDefinition {
  id: HeroId;
  name: string;
  class: string;
  color: string;
  emoji: string;
}

export interface ShieldCard {
  id: string;
  cardId: string;
  remaining: number;
}

export interface PlayerState {
  name: string;
  heroId: HeroId | null;
  hp: number;
  hand: string[];
  ready: boolean;
  eliminated: boolean;
  shieldCards?: ShieldCard[];
  shields?: number;
  immune?: boolean;
  jaheiraForm?: 'bear' | 'wolf' | 'none' | null;
  frienemiesBonus?: number;
}

export interface ActionLogEntry {
  description: string;
  timestamp: number;
  playerId?: PlayerId;
  cardId?: string;
  targetId?: PlayerId | null;
}

export interface PendingShieldPick {
  pickerId: PlayerId;
  effect: 'steal_shield' | 'destroy_one_shield';
  targetId: PlayerId;
}

export interface PendingPickpocket {
  pickerId: PlayerId;
  stolenCardId: string;
  ownerId: PlayerId;
  targetId?: PlayerId;
}

export interface RoomState {
  hostId: PlayerId;
  status: GameStatus;
  gameMode?: GameMode;
  players: Record<PlayerId, PlayerState>;
  decks: Record<PlayerId, string[]>;
  discardPiles: Record<PlayerId, string[]>;
  currentTurn: PlayerId | null;
  turnOrder: PlayerId[];
  turnPhase?: TurnPhase;
  winner: PlayerId | null;
  finishAt?: number | null;
  rolls?: Record<PlayerId, number>;
  playedThisTurn?: Record<PlayerId, string[]>;
  cardsPlayedThisTurn?: number;
  extraPlaysThisTurn?: number;
  extraPlayCardIds?: string[] | null;
  remixPowerAssignments?: Record<PlayerId, {
    ids: string[];
    itemKeys: string[];
    sourceHeroIds: HeroId[];
    slotsUsed: number;
  }> | null;
  pendingReclaim?: PlayerId | null;
  pendingShieldPick?: PendingShieldPick | null;
  pendingPickpocket?: PendingPickpocket | null;
  eliminationOrder?: PlayerId[];
  lastAction: ActionLogEntry | null;
  actionLog: ActionLogEntry[];
}
