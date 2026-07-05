import { cn } from '@/lib/utils'

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}) {
  const base = 'inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100'

  const variants = {
    default: 'bg-primary text-primary-foreground shadow-[0_1px_0_var(--glass-highlight)_inset,0_1px_2px_rgba(0,0,0,0.4)] hover:brightness-110',
    destructive: 'bg-destructive text-destructive-foreground shadow-[0_1px_2px_rgba(0,0,0,0.4)] hover:brightness-110',
    outline: 'border border-border bg-white/[0.03] hover:bg-accent/15 hover:text-accent-foreground',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    ghost: 'hover:bg-white/[0.06]',
    link: 'text-primary underline-offset-4 hover:underline rounded-none',
  }

  const sizes = {
    default: 'h-9 px-4 py-2',
    sm: 'h-8 px-3 text-xs',
    lg: 'h-10 px-8',
    icon: 'h-9 w-9 rounded-full',
  }
  
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  )
}

export { Button }
