

## Přeuspořádání navigace

Upravím pořadí položek v navigačním menu v souboru `src/components/AppSidebar.tsx`.

### Současné pořadí
1. Domů
2. Vouchery
3. Obchodní případy
4. Smlouvy
5. Statistiky
6. Klienti
7. Dodavatelé
8. Destinace

### Nové pořadí
1. Domů
2. Obchodní případy
3. Smlouvy
4. Vouchery
5. Statistiky
6. Klienti
7. Dodavatelé
8. Destinace

### Technické detaily

Změna spočívá v přeuspořádání pole `menuItems` v souboru `src/components/AppSidebar.tsx`:

```typescript
const menuItems = [
  { title: "Domů", url: "/", icon: Home },
  { title: "Obchodní případy", url: "/deals", icon: Briefcase },
  { title: "Smlouvy", url: "/contracts", icon: FileSignature },
  { title: "Vouchery", url: "/vouchers", icon: FileText },
  { title: "Statistiky", url: "/statistics", icon: BarChart3 },
  { title: "Klienti", url: "/clients", icon: Users },
  { title: "Dodavatelé", url: "/suppliers", icon: Building2 },
  { title: "Destinace", url: "/destinations", icon: MapPin },
];
```

### Soubory k úpravě
- `src/components/AppSidebar.tsx` - přeuspořádání pole menuItems

