import {
  type ButtonHTMLAttributes,
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  useId,
} from 'react'
import { Icon, type IconName } from './Icon.tsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-110 active:brightness-95',
  secondary: 'bg-surface text-ink ring-1 ring-line hover:bg-sunken',
  ghost: 'text-ink hover:bg-sunken',
  danger: 'text-danger hover:bg-danger/10',
}

export function Button({
  variant = 'secondary',
  icon,
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  icon?: IconName
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizes = {
    sm: 'h-8 px-3 text-sm gap-1.5',
    md: 'h-10 px-4 text-sm gap-2',
    lg: 'h-12 px-5 text-base gap-2',
  }
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center rounded-full font-medium transition-[filter,background-color,transform] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none ${sizes[size]} ${VARIANTS[variant]} ${className}`}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
    </button>
  )
}

export function IconButton({
  icon,
  label,
  className = '',
  size = 40,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; size?: number }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      style={{ width: size, height: size }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-sunken disabled:opacity-40 ${className}`}
    >
      <Icon name={icon} size={Math.round(size * 0.45)} />
    </button>
  )
}

const inputClass =
  'w-full rounded-xl bg-surface px-3.5 py-2.5 text-[15px] text-ink ring-1 ring-line placeholder:text-faint transition-shadow focus:outline-none focus:ring-2 focus:ring-accent'

export function Field({
  label,
  hint,
  error,
  children,
  className = '',
}: {
  label: string
  hint?: ReactNode
  error?: string | null
  children: (id: string) => ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-muted">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p className="mt-1.5 text-[13px] text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[13px] text-faint">{hint}</p>
      ) : null}
    </div>
  )
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className = '', ...rest }, ref) {
    return <input ref={ref} {...rest} className={`${inputClass} ${className}`} />
  },
)

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ className = '', ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      {...rest}
      className={`${inputClass} min-h-32 resize-y leading-relaxed ${className}`}
    />
  )
})

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
}) {
  const name = useId()
  return (
    <fieldset className="flex rounded-xl bg-sunken p-1">
      <legend className="sr-only">{label}</legend>
      {options.map((o) => (
        <label
          key={o.value}
          className={`flex-1 cursor-pointer rounded-lg px-2 py-1.5 text-center text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${value === o.value ? 'bg-surface font-medium text-ink shadow-lift' : 'text-muted hover:text-ink'}`}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  )
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-[15px]">
      <span>{label}</span>
      <span className="relative inline-flex">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="h-6 w-10 rounded-full bg-line transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2" />
        <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface shadow-lift transition-transform duration-200 ease-out-soft peer-checked:translate-x-4" />
      </span>
    </label>
  )
}
