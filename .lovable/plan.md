
## Plán: Poznámky ve veřejné nabídce jako odrážkový seznam

**Cíl:** Zobrazit poznámky varianty ve veřejné nabídce jako seznam s odrážkami — každý řádek (oddělený `\n`) se zobrazí jako samostatná položka `<li>`.

**Změna:** Pouze 1 soubor, 1 místo — `src/pages/PublicOffer.tsx`, řádky 683–685.

**Aktuálně:**
```tsx
<p className="text-xs text-slate-400 italic border-t pt-3">{variant.notes}</p>
```

**Nově:**
```tsx
<ul className="text-xs text-slate-400 italic border-t pt-3 space-y-1 list-disc list-inside">
  {variant.notes.split('\n').filter(line => line.trim()).map((line, i) => (
    <li key={i}>{line.trim()}</li>
  ))}
</ul>
```

- Prázdné řádky se přeskočí přes `.filter(line => line.trim())`
- `list-disc list-inside` = kulaté odrážky zarovnané s textem
- Styl zachován (stejná barva, kurzíva, oddělující čára)
