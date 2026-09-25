import type { ReactNode } from "react";

interface BidiProps {
  children?: ReactNode;
  className?: string;
  /**
   * Base direction for this token.
   *
   * Omit it for auto: the first strong character decides, so free-form
   * content (addresses, property names, dates) keeps its natural direction
   * whatever surrounds it. Pass `"ltr"` for data that is intrinsically
   * left-to-right but starts with weak characters — phone numbers and email
   * addresses begin with `+` or digits, which carry no direction, so inside
   * an RTL page they will otherwise be visually reversed
   * (`+213 555 10 20 09` rendering as `09 20 10 555 213+`).
   */
  dir?: "ltr" | "rtl";
}

/**
 * Bidirectional isolation wrapper (a `<bdi>`): the token can neither reorder
 * against its neighbours nor be reordered by them in a mixed-direction line,
 * and its own base direction resolves independently of the page direction.
 * This is what keeps Arabic labels right-to-left while letting LTR values
 * (phone, email, house-numbered addresses) render in their natural order.
 */
export function Bidi({ children, className, dir }: BidiProps) {
  return (
    <bdi dir={dir} className={className}>
      {children}
    </bdi>
  );
}