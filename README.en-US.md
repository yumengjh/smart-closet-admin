# Smart Closet Admin

Standalone admin frontend for Smart Closet (鱼搭), built with Vue 3 and Element Plus. It talks to `smart-closet-admin-server`, which reaches the closet service through the neutral management API.

- Home: the business screen (users, wardrobe, outfits and recommendations at a glance), light or dark with the platform theme.
- Closet: insights, business users, runtime monitoring, data export, template review.
- System: users, roles and permissions, menus, runtime config, IP rules, audit log, data cleanup, SQL console, and the platform's own runtime overview.

## Development

```bash
pnpm install
pnpm dev        # http://localhost:8849, API proxied to VITE_API_TARGET (default http://127.0.0.1:8081)
pnpm typecheck
pnpm build
```

Menu icons come from the backend as keys registered in `src/components/ReIcon/src/offlineIcon.ts` (for example `ri/pulse-line`).

Based on [pure-admin-thin](https://github.com/pure-admin/pure-admin-thin) (MIT).
