"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as SheetPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

/** Arrastar pro lado de fora fecha o painel (gesto do celular). Ignora áreas com rolagem horizontal. */
function useSwipeToClose(side: "top" | "right" | "bottom" | "left") {
  const start = React.useRef<{ x: number; y: number; t: number; skip: boolean } | null>(null)
  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const p = e.touches[0]
    let el = e.target as HTMLElement | null
    let skip = false
    while (el && el !== e.currentTarget) {
      if (el.scrollWidth > el.clientWidth + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowX)) {
        skip = true
        break
      }
      el = el.parentElement
    }
    start.current = { x: p.clientX, y: p.clientY, t: Date.now(), skip }
  }
  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const s = start.current
    start.current = null
    if (!s || s.skip) return
    const p = e.changedTouches[0]
    const dx = p.clientX - s.x
    const dy = p.clientY - s.y
    const fast = Date.now() - s.t < 600
    const horizontal = Math.abs(dx) > Math.abs(dy) * 1.8
    const out = side === "right" ? dx > 80 : side === "left" ? dx < -80 : false
    if (horizontal && out && fast) {
      // o Radix fecha com Esc; reaproveita o mesmo caminho
      e.currentTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    }
  }
  return { onTouchStart, onTouchEnd }
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
}) {
  const swipe = useSwipeToClose(side)
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        onTouchStart={swipe.onTouchStart}
        onTouchEnd={swipe.onTouchEnd}
        className={cn(
          "fixed z-50 flex flex-col gap-4 overscroll-contain bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:duration-300",
          side === "right" &&
            "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
          side === "left" &&
            "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
          side === "top" &&
            "inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
          side === "bottom" &&
            "inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          className
        )}
        {...props}
      >
        {showCloseButton && (
          // fica grudado no topo mesmo rolando o painel, abaixo do relógio/Dynamic Island
          <div className="pointer-events-none sticky top-0 z-30 -mb-4 flex h-0 justify-end">
            <SheetPrimitive.Close className="pointer-events-auto mt-3 mr-3 flex size-10 items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/85 text-slate-100 shadow-lg backdrop-blur transition-transform active:scale-90 focus:ring-2 focus:ring-ring focus:outline-hidden">
              <XIcon className="size-5" />
              <span className="sr-only">Fechar</span>
            </SheetPrimitive.Close>
          </div>
        )}
        {children}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4 pr-16", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
