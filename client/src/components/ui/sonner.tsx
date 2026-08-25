import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { CircleAlert, CircleCheck, CircleX, Info } from "lucide-react";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      closeButton
      richColors
      icons={{
        success: <CircleCheck aria-hidden="true" size={18} />,
        info: <Info aria-hidden="true" size={18} />,
        warning: <CircleAlert aria-hidden="true" size={18} />,
        error: <CircleX aria-hidden="true" size={18} />,
      }}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
