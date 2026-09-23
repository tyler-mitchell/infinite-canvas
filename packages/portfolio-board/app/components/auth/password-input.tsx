import { useAuth } from "@better-auth-ui/react"
import { Eye, EyeOff } from "lucide-react"
import { useState, type ComponentProps } from "react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "@/components/ui/input-group"

export function PasswordInput(props: Omit<ComponentProps<"input">, "type">) {
  const { localization } = useAuth()
  const [visible, setVisible] = useState(false)
  const label = visible ? localization.auth.hidePassword : localization.auth.showPassword
  return (
    <InputGroup>
      <InputGroupInput {...props} type={visible ? "text" : "password"} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={label}
          title={label}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff /> : <Eye />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
