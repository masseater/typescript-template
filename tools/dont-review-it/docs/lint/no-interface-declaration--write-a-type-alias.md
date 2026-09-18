---
description: "Disallow declaring an object type with an interface outside an ambient module, so every object type is written one way and only the declarations that must merge into a module or the global scope keep the form that merges"
---

# no-interface-declaration--write-a-type-alias

<!-- BEGIN GENERATED rule-header -->
<!-- END GENERATED rule-header -->

## Violation

An `interface` declaration anywhere outside an ambient module. A top level interface, an exported one, one inside a namespace that is not declared ambient and one inside a function body are all reported.

An interface inside `declare module`, `declare global` or `declare namespace`, at any depth, is not read. Those declarations augment a module or a scope another package owns, and declaration merging is the one job a `type` alias cannot do: a `type` of the same name there collides with the owner's interface instead of adding to it.

## Fix

Write the object type as a `type` alias. `extends` becomes an intersection.

```ts
type AdminUser = User & { readonly permissions: readonly string[] };
```

<!-- BEGIN GENERATED examples -->
<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Wrapping an interface in `declare namespace` only to pass the rule. Nothing merges into a namespace the file itself invents
- Turning a module augmentation into a `type` alias. The augmentation stops adding to the owner's interface and the checker reports a duplicate identifier

## Messages

<!-- BEGIN GENERATED messages -->
<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->
<!-- END GENERATED runtime -->
