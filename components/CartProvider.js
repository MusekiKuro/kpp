'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const CartContext = createContext(undefined);

const STORAGE_KEY = 'nurset_cart';

function readStorage() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.id === 'string' && Number.isInteger(item.qty) && item.qty > 0)
      .map((item) => ({ id: item.id, qty: Math.min(item.qty, 99) }));
  } catch {
    return [];
  }
}

function writeStorage(items) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage full – silently ignore
  }
}

export default function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [mounted, setMounted] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    // Keep storage hydration after mount so the server and first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(readStorage());
    setMounted(true);
  }, []);

  // Persist whenever items change (skip initial empty render)
  useEffect(() => {
    if (mounted) {
      writeStorage(items);
    }
  }, [items, mounted]);

  const addToCart = useCallback((product) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { id: product.id, qty: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setItems((prev) => prev.filter((item) => item.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId, qty) => {
    if (qty < 1) {
      setItems((prev) => prev.filter((item) => item.id !== productId));
      return;
    }
    setItems((prev) =>
      prev.map((item) => (item.id === productId ? { ...item, qty } : item))
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  return (
    <CartContext.Provider
      value={{ items, addToCart, removeFromCart, updateQuantity, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (ctx === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
