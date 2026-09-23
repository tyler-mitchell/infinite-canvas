import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import type { ReactNode } from "react";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const avatar = tv({
  slots: {
    root: "relative inline-flex flex-none items-center justify-center overflow-hidden bg-[image:var(--pk-tile-face)] shadow-[var(--pk-tile-ring)] select-none",
    background: "pointer-events-none absolute inset-0",
    image: "relative size-full object-cover",
    fallback: "relative font-pk-sans text-pk-tile-ink uppercase",
    bloom: "pointer-events-none absolute inset-0 bg-[image:var(--pk-tile-bloom)]",
  },
  variants: {
    size: {
      sm: { root: "size-5 rounded-pk-control-inner", fallback: "text-pk-micro" },
      md: { root: "size-10 rounded-pk-control", fallback: "text-pk-body font-semibold" },
      lg: {
        root: "size-16.5 rounded-pk-inner",
        fallback: "text-[21px] leading-[1.4] font-semibold tracking-[-0.03em]",
      },
    },
  },
  defaultVariants: { size: "lg" },
});

export type AvatarProps = Omit<AvatarPrimitive.Root.Props, "className" | "children"> &
  VariantProps<typeof avatar> & {
    readonly className?: string;
    readonly background?: ReactNode;
    /** Omit for a tile that is only ever initials. */
    readonly src?: string;
    /** Names the person. Also the image's alternative text. */
    readonly name: string;
    /** Defaults to the first letter of each of the first two words in `name`. */
    readonly initials?: string;
  };

function Avatar({ src, name, initials, size, className, background, ...props }: AvatarProps) {
  const styles = avatar({ size });
  const mark =
    initials ??
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.slice(0, 1))
      .join("");

  return (
    <AvatarPrimitive.Root data-slot="avatar" className={styles.root({ className })} {...props}>
      {background ? <span data-slot="avatar-background" aria-hidden className={styles.background()}>{background}</span> : null}
      {src ? <AvatarPrimitive.Image data-slot="avatar-image" src={src} alt={name} className={styles.image()} /> : null}
      {/* A name of nothing would override the initials with an empty string rather than add to them. */}
      <AvatarPrimitive.Fallback
        aria-label={name.trim().length > 0 ? name : undefined}
        className={styles.fallback()}
      >
        {mark}
      </AvatarPrimitive.Fallback>
      <span aria-hidden className={styles.bloom()} />
    </AvatarPrimitive.Root>
  );
}

export { Avatar, avatar as avatarVariants };
