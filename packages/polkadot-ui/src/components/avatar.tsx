import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import { tv, type VariantProps } from "tailwind-variants";

/*
 * A rounded tile carrying a face or the initials that stand in for one.
 *
 * Base UI owns the part that is easy to get wrong: the fallback shows while the image is loading and
 * stays if it never arrives, so there is no flash of initials behind a picture that loads instantly.
 *
 * The radius steps with the size. One fixed radius reads as a circle at the small end and as a
 * square at the large end, which are two different objects.
 */
const avatar = tv({
  slots: {
    root: "pk-face relative inline-flex flex-none items-center justify-center overflow-hidden border border-pk-line-inner-raised select-none",
    image: "size-full object-cover",
    fallback: "font-pk-sans text-pk-ink-muted uppercase",
  },
  variants: {
    size: {
      sm: { root: "size-6 rounded-[6px]", fallback: "text-pk-micro" },
      md: { root: "size-9 rounded-pk-control", fallback: "text-pk-label" },
      lg: { root: "size-14 rounded-pk-inner", fallback: "text-pk-title" },
    },
  },
  defaultVariants: { size: "md" },
});

export type AvatarProps = Omit<AvatarPrimitive.Root.Props, "className" | "children"> &
  VariantProps<typeof avatar> & {
    readonly className?: string;
    /** Omit for a tile that is only ever initials. */
    readonly src?: string;
    /** Names the person. Also the image's alternative text. */
    readonly name: string;
    /** Defaults to the first letter of each of the first two words in `name`. */
    readonly initials?: string;
  };

function Avatar({ src, name, initials, size, className, ...props }: AvatarProps) {
  const styles = avatar({ size });
  const mark =
    initials ??
    name
      .split(" ")
      .slice(0, 2)
      .map((word) => word.slice(0, 1))
      .join("");

  return (
    <AvatarPrimitive.Root data-slot="avatar" className={styles.root({ className })} {...props}>
      {src ? <AvatarPrimitive.Image src={src} alt={name} className={styles.image()} /> : null}
      <AvatarPrimitive.Fallback aria-label={name} className={styles.fallback()}>
        {mark}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export { Avatar, avatar as avatarVariants };
