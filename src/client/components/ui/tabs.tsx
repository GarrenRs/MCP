import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

/**
 * Track the active document direction so Radix Tabs mirrors in RTL.
 *
 * Radix renders `dir="ltr"` on the Tabs root by default, which pins the strip
 * (and arrow-key navigation) to LTR even when the app is in Arabic. Passing
 * `dir` sourced from `document.documentElement.dir` keeps every tab instance
 * LTR in French/English and mirrored in Arabic, with RTL-correct arrow keys.
 */
function useDocumentDirection(): "ltr" | "rtl" {
  const [dir, setDir] = React.useState<"ltr" | "rtl">("ltr");
  React.useEffect(() => {
    const update = () => setDir(document.documentElement.dir === "rtl" ? "rtl" : "ltr");
    update();
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["dir"] });
    return () => mo.disconnect();
  }, []);
  return dir;
}

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>((props, ref) => {
  const dir = useDocumentDirection();
  return <TabsPrimitive.Root ref={ref} dir={dir} {...props} />;
});
Tabs.displayName = TabsPrimitive.Root.displayName;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const dir = useDocumentDirection();
  return (
    <TabsPrimitive.List
      ref={ref}
      dir={dir}
      className={cn("inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", className)}
      {...props}
    />
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const dir = useDocumentDirection();
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      dir={dir}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium text-muted-foreground transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:rounded-sm data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-raised",
        className,
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => {
  const dir = useDocumentDirection();
  return (
    <TabsPrimitive.Content
      ref={ref}
      dir={dir}
      className={cn(
        "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
      {...props}
    />
  );
});
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
