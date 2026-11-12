#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name "Eval User"
git config user.email "eval@example.com"
mkdir -p docs/adr src/domain src/infra
printf '{\n  "name": "orders",\n  "type": "module",\n  "scripts": { "test": "node --test" }\n}\n' > package.json
cat > docs/adr/001-orders.md <<'MD'
# ADR 001: Orders

Status: accepted

## Decision

An order is never hard-deleted. A customer or operator cancels an order, and the
row stays for audit and refunds.
MD
cat > src/domain/order.ts <<'TS'
export interface Order {
  id: string;
  total: number;
  cancelledAt: Date | null;
}

export function cancel(order: Order, now: Date): Order {
  return { ...order, cancelledAt: order.cancelledAt ?? now };
}
TS
git add -A
git commit -q -m "feat: add order domain with cancel"
git switch -q -c feat/order-repository
cat > src/infra/order-repository.ts <<'TS'
import type { Order } from "../domain/order.js";

interface Db {
  query(sql: string, params: unknown[]): Promise<unknown>;
}

function toRow(order: Order): unknown[] {
  return [order.id, order.total, order.cancelledAt ?? null];
}

export class OrderRepository {
  constructor(private readonly db: Db) {}

  async save(order: Order): Promise<void> {
    await this.db.query(
      "INSERT INTO orders (id, total, cancelled_at) VALUES ($1, $2, $3) " +
        "ON CONFLICT (id) DO UPDATE SET total = $2, cancelled_at = $3",
      toRow(order),
    );
  }

  async remove(id: string): Promise<void> {
    await this.db.query("DELETE FROM orders WHERE id = $1", [id]);
  }
}
TS
git add -A
git commit -q -m "feat: add order repository"
