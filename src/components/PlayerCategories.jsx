import React from 'react';

export default function PlayerCategories({ categories }) {
  if (!categories.length) return null;
  return (
    <div className="player-categories" role="group" aria-label="Player categories">
      <strong>Categories</strong>
      {categories.map(name => <span key={name} className="badge badge-gold">{name}</span>)}
    </div>
  );
}
