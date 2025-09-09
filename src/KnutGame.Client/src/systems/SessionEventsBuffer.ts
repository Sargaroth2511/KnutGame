import { ItemType } from '../items'

export type SessionEvents = {
  moves: { t: number; x: number }[]
  hits: { t: number }[]
  items: { t: number; id: string; type: ItemType; x: number; y: number }[]
}

export class SessionEventsBuffer {
  private events: SessionEvents = { moves: [], hits: [], items: [] }

  reset() {
    this.events = { moves: [], hits: [], items: [] }
  }

  snapshot(): SessionEvents {
    return this.events
  }

  pushMove(tMs: number, x: number) {
    this.events.moves.push({ t: Math.round(tMs), x })
  }

  pushHit(tMs: number) {
    this.events.hits.push({ t: Math.round(tMs) })
  }

  pushItem(tMs: number, id: string, type: ItemType, x: number, y: number) {
    this.events.items.push({ t: Math.round(tMs), id, type, x, y })
  }
}

