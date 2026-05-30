import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Copy,
  Check,
  ExternalLink,
  Plug,
  PlugZap,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
  AlertCircle,
  MessageCircle,
  MessageSquare,
  Send,
  Bot,
  Sparkles,
  ShoppingCart,
  ShoppingBag,
  Store,
  Package,
  Cloud,
  Headphones,
  LifeBuoy,
  Tag,
  CreditCard,
  Building2,
  CheckCircle2,
  Users,
  Package2,
  Truck,
  Plane,
  Ship,
  MapPin,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────
   Types
────────────────────────────────────────────────────────────────── */
type PlatformStatus   = "disconnected" | "pending" | "connected" | "error";
type PlatformCategory = "Messaging" | "E-Commerce" | "CRM & Helpdesk" | "Payments" | "Couriers";
type IntegrationType  = "messaging" | "ecommerce" | "crm" | "payment" | "courier";

interface PlatformIntegration {
  id: string;
  business_id: string;
  platform: string;
  status: PlatformStatus;
  credentials: Record<string, string>;
  webhook_verify_token: string;
  webhook_verified: boolean;
  platform_account_name: string | null;
  platform_account_id: string | null;
  connected_at: string | null;
  last_message_at: string | null;
  message_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface CredentialField {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "password";
  hint?: string;
}

interface PlatformConfig {
  id: string;
  name: string;
  tagline: string;
  icon: React.ReactNode;
  color: string;        // tailwind bg class
  textColor: string;    // tailwind text class
  borderColor: string;  // tailwind border class
  docsUrl: string;
  credentialFields: CredentialField[];
  setupSteps: { title: string; description: string }[];
  category: PlatformCategory;
  integrationType: IntegrationType;
  syncs?: string[];     // displayed for ecommerce / crm / payment
  comingSoon?: boolean;
}

/* ──────────────────────────────────────────────────────────────────
   Brand SVG icons (inline, fill="currentColor")
────────────────────────────────────────────────────────────────── */
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
    <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.652V24l4.088-2.242c1.092.3 2.246.464 3.443.464 6.627 0 12-4.975 12-11.111C24 4.974 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.259L19.752 8l-6.561 6.963z" />
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

const TelegramIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

const TwitterXIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.261 5.632 5.903-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.011.043.031.055a19.9 19.9 0 005.993 3.029.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const SlackIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
    <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z" />
  </svg>
);

const ShopifyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
    <path d="M15.337 5.324l-.276-1.779c-.02-.136-.138-.232-.276-.232-.138 0-1.48.07-1.48.07-.758-.759-1.654-.967-2.137-.897-.414-.138-.828.137-.965.482-.07.207-.07.483 0 .69.137.344.344.552.62.62.276.07.621-.069.828-.344l.069-.138c.483-.69 1.103-.69 1.517-.414.276.207.414.552.414.897l-.069 1.103c-.69.069-1.31.276-1.862.552-.69.275-1.31.758-1.724 1.378-.413.621-.62 1.38-.62 2.138 0 1.241.551 2.206 1.585 2.758.758.413 1.654.551 2.55.482.07-.137.138-.344.138-.551V5.669c0-.138-.07-.276-.138-.345zM12 8.07c-.828 0-1.517.69-1.517 1.517S11.172 11.103 12 11.103s1.517-.69 1.517-1.516S12.828 8.07 12 8.07zM20.69 5.255l-1.172-.276c-.069-.207-.207-.483-.414-.69l.414-1.379-.966-.276-.552 1.241c-.207-.069-.483-.069-.69-.069l-.69-1.172-.897.483.621 1.172c-.138.138-.276.345-.345.552l-1.31-.069-.138.966 1.31.207c.07.207.138.483.276.69l-.69 1.241.897.483.69-1.172c.207.069.414.138.621.138l.276 1.241.966-.276-.345-1.31c.207-.138.345-.345.483-.552l1.241.345.276-.966-1.103-.552zm-2.965 2.413c-.621 0-1.103-.482-1.103-1.103s.482-1.103 1.103-1.103c.62 0 1.103.483 1.103 1.103s-.483 1.103-1.103 1.103zM8.276 18.207H6.897l-.552-6.69H4.69l.621 7.38c.069.483.483.827.966.827h3.862l-.483-1.517H8.276zM14.69 11.517h-1.655l-.207 6.69h-1.31l-.207-6.69H9.586l.207 8.207h5.517l-.62-8.207z" />
  </svg>
);

const WooCommerceIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
    <path d="M2.047 0C.919 0 0 .92 0 2.047v15.816c0 1.128.919 2.047 2.047 2.047h7.871l-1.078 3.067 4.935-3.067H21.953C23.081 19.91 24 18.99 24 17.863V2.047C24 .92 23.081 0 21.953 0H2.047zM6.62 5.98c.329-.01.63.212.737.544.398 1.335.845 2.72 1.275 3.905.734-1.4 1.48-3.049 1.96-4.389.124-.35.44-.561.776-.544.281.014.523.196.642.466.606 1.397 1.283 2.967 1.948 4.345.38-1.246.754-2.675.994-3.799.107-.5.557-.808 1.037-.7.48.107.773.587.666 1.087-.467 2.187-1.15 4.67-1.793 6.45-.138.392-.495.634-.88.617-.37-.016-.688-.268-.818-.644-.585-1.662-1.29-3.387-1.963-4.784-.547 1.224-1.083 2.74-1.508 4.215-.114.395-.462.636-.838.613-.37-.023-.683-.285-.796-.674-.554-1.918-1.447-4.985-1.947-7.147-.108-.47.183-.945.652-1.063a.91.91 0 01.152-.048zm10.82 1.74a2.716 2.716 0 011.86 2.575 2.716 2.716 0 01-2.716 2.715 2.716 2.716 0 01-2.716-2.715 2.716 2.716 0 012.716-2.716c.287 0 .577.047.856.14zm-.856 1.385a1.33 1.33 0 100 2.661 1.33 1.33 0 000-2.661z" />
  </svg>
);

const AmazonIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
    <path d="M13.958 10.09c0 1.232.029 2.256-.591 3.351-.502.891-1.301 1.438-2.186 1.438-1.214 0-1.922-.924-1.922-2.292 0-2.692 2.415-3.182 4.699-3.182v.685zm3.186 7.705c-.209.189-.512.201-.748.074-1.052-.872-1.238-1.276-1.814-2.106-1.734 1.767-2.962 2.297-5.209 2.297-2.66 0-4.731-1.641-4.731-4.925 0-2.565 1.391-4.309 3.37-5.164 1.715-.754 4.11-.891 5.942-1.099v-.41c0-.753.06-1.642-.383-2.294-.385-.579-1.124-.818-1.775-.818-1.205 0-2.277.618-2.54 1.897-.054.285-.261.567-.549.582l-3.061-.33c-.259-.057-.548-.266-.472-.66.704-3.716 4.06-4.836 7.067-4.836 1.537 0 3.547.41 4.758 1.574 1.538 1.436 1.392 3.352 1.392 5.438v4.923c0 1.481.616 2.13 1.192 2.929.204.286.249.629-.012.842-.646.541-1.796 1.542-2.427 2.105z" />
    <path d="M20.945 18.505c-2.511 1.787-6.154 2.738-9.293 2.738-4.397 0-8.352-1.626-11.344-4.329-.235-.213-.025-.503.257-.337 3.23 1.877 7.22 3.009 11.343 3.009 2.781 0 5.842-.576 8.657-1.769.424-.181.779.278.38.688z" />
    <path d="M21.951 17.357c-.32-.411-2.118-.194-2.926-.098-.245.031-.283-.184-.062-.338 1.434-1.008 3.787-.717 4.063-.379.277.34-.073 2.695-1.418 3.819-.207.173-.403.081-.312-.147.302-.754.976-2.446.655-2.857z" />
  </svg>
);

const StripeIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
    <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
  </svg>
);

const PayPalIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
    <path d="M7.076 21.337H2.47a.641.641 0 01-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 00-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 00-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 00.554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 01.923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z" />
  </svg>
);

const HubSpotIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
    <path d="M22.168 8.222a3.977 3.977 0 00-1.289-1.289V4.667a1.333 1.333 0 10-2.666 0v2.178a3.99 3.99 0 00-1.955 1.097 3.978 3.978 0 00-1.06 2.012l-3.75-.883a2.4 2.4 0 00-2.31-3.107 2.4 2.4 0 00-2.4 2.4c0 .782.376 1.474.957 1.912l-1.267 2.972a2.4 2.4 0 00-.691 4.636 2.4 2.4 0 002.978-2.978l1.267-2.972a2.38 2.38 0 001.156-.098l3.75.883a3.988 3.988 0 001.97 2.57 3.979 3.979 0 001.355.424v2.223a1.333 1.333 0 102.666 0v-2.223a3.992 3.992 0 001.956-1.098A3.99 3.99 0 0024 12.222a3.99 3.99 0 00-1.832-3.999zm-3.946 4.667a1.333 1.333 0 110-2.667 1.333 1.333 0 010 2.667z" />
  </svg>
);

/* ──────────────────────────────────────────────────────────────────
   Platform configurations
────────────────────────────────────────────────────────────────── */
const PLATFORMS: PlatformConfig[] = [

  /* ── MESSAGING ─────────────────────────────────────────────── */
  {
    id: "whatsapp",
    category: "Messaging",
    integrationType: "messaging",
    name: "WhatsApp",
    tagline: "Serve 2B+ users directly in WhatsApp",
    icon: <WhatsAppIcon />,
    color: "bg-green-500/10",
    textColor: "text-green-600 dark:text-green-400",
    borderColor: "border-green-500/30",
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
    credentialFields: [
      { key: "phone_number_id",             label: "Phone Number ID",        placeholder: "123456789012345",   hint: "Found in Meta Developer Console → WhatsApp → API Setup" },
      { key: "whatsapp_business_account_id", label: "Business Account ID",   placeholder: "123456789012345",   hint: "From Meta Business Manager → Business Settings → WhatsApp accounts" },
      { key: "access_token",                label: "Permanent Access Token", placeholder: "EAAxxxxxxxxxxxxxx", type: "password", hint: "Generate a permanent token via Meta Business Manager → System Users" },
    ],
    setupSteps: [
      { title: "Create a Meta App",     description: "Go to Meta for Developers and create an app with the WhatsApp product." },
      { title: "Get your credentials",  description: "In WhatsApp → API Setup, copy your Phone Number ID and generate a permanent access token." },
      { title: "Paste & save",          description: "Paste your credentials below and click Save." },
      { title: "Configure the webhook", description: "In Meta Developer Console → WhatsApp → Configuration → Webhooks, paste the Webhook URL and Verify Token. Subscribe to 'messages'." },
      { title: "Test it",               description: "Send a WhatsApp message to your business number — OctaDezx AI will reply automatically!" },
    ],
  },
  {
    id: "facebook",
    category: "Messaging",
    integrationType: "messaging",
    name: "Facebook Messenger",
    tagline: "Automate conversations on your Facebook Page",
    icon: <FacebookIcon />,
    color: "bg-blue-500/10",
    textColor: "text-blue-600 dark:text-blue-400",
    borderColor: "border-blue-500/30",
    docsUrl: "https://developers.facebook.com/docs/messenger-platform/get-started",
    credentialFields: [
      { key: "page_id",           label: "Facebook Page ID",    placeholder: "123456789012345",   hint: "Found in your Page's About section or Settings → Page Info" },
      { key: "page_access_token", label: "Page Access Token",   placeholder: "EAAxxxxxxxxxxxxxx", type: "password", hint: "Generate in Meta Developer Console → Messenger → Settings → Access Tokens" },
      { key: "app_secret",        label: "App Secret",          placeholder: "abc123def456...",   type: "password", hint: "Found in Meta App → Settings → Basic → App Secret" },
    ],
    setupSteps: [
      { title: "Create a Meta App",  description: "Create a new app at developers.facebook.com and add the Messenger product." },
      { title: "Connect your Page",  description: "In Messenger → Settings, generate a Page Access Token for your Facebook Page." },
      { title: "Paste credentials",  description: "Paste your Page ID, Page Access Token and App Secret, then click Save." },
      { title: "Set up the webhook", description: "In Meta App → Messenger → Webhooks, paste the Webhook URL. Use the Verify Token shown. Subscribe to 'messages' and 'messaging_postbacks'." },
      { title: "Go live",            description: "Customers message your Facebook Page — OctaDezx handles every conversation." },
    ],
  },
  {
    id: "instagram",
    category: "Messaging",
    integrationType: "messaging",
    name: "Instagram DM",
    tagline: "Reply to Instagram Direct Messages with AI",
    icon: <InstagramIcon />,
    color: "bg-pink-500/10",
    textColor: "text-pink-600 dark:text-pink-400",
    borderColor: "border-pink-500/30",
    docsUrl: "https://developers.facebook.com/docs/messenger-platform/instagram",
    credentialFields: [
      { key: "instagram_account_id", label: "Instagram Business Account ID", placeholder: "123456789012345",   hint: "From Meta Business Manager → Instagram accounts" },
      { key: "page_access_token",    label: "Page Access Token",             placeholder: "EAAxxxxxxxxxxxxxx", type: "password", hint: "Same token as your linked Facebook Page" },
    ],
    setupSteps: [
      { title: "Link to a Facebook Page", description: "Your Instagram Business account must be linked to a Facebook Page in Business Manager." },
      { title: "Enable DM access",        description: "In Meta Developer Console → Messenger → Instagram Settings, enable access to Instagram Direct Messages." },
      { title: "Paste credentials",       description: "Enter your Instagram Business Account ID and Page Access Token." },
      { title: "Configure webhook",       description: "In your Meta App → Webhooks, add the Webhook URL. Subscribe to 'instagram_messages'." },
      { title: "Test it",                 description: "Send a DM to your Instagram Business account — OctaDezx AI replies instantly." },
    ],
  },
  {
    id: "telegram",
    category: "Messaging",
    integrationType: "messaging",
    name: "Telegram",
    tagline: "Deploy an AI-powered Telegram bot in minutes",
    icon: <TelegramIcon />,
    color: "bg-sky-500/10",
    textColor: "text-sky-600 dark:text-sky-400",
    borderColor: "border-sky-500/30",
    docsUrl: "https://core.telegram.org/bots/tutorial",
    credentialFields: [
      { key: "bot_token",  label: "Bot Token",  placeholder: "1234567890:ABCxxxxxxxxxxxxxxxxxxxx", type: "password", hint: "Get this from @BotFather on Telegram — /newbot to create, then copy the token" },
      { key: "bot_username", label: "Bot Username", placeholder: "MyShopBot",                        hint: "The username you chose in @BotFather (without @)" },
    ],
    setupSteps: [
      { title: "Create a bot via @BotFather", description: "Open Telegram, message @BotFather, run /newbot, choose a name and username." },
      { title: "Copy the token",              description: "BotFather will give you a token like 1234567890:ABCxxxx. Copy it." },
      { title: "Paste & save",                description: "Paste your bot token below — OctaDezx automatically registers the webhook for you. No manual URL pasting needed." },
      { title: "Done!",                       description: "Send a message to your bot on Telegram — OctaDezx AI will respond instantly." },
    ],
  },
  {
    id: "viber",
    category: "Messaging",
    integrationType: "messaging",
    name: "Viber",
    tagline: "Reach Viber's 1B+ users with AI chat",
    icon: <MessageCircle className="h-7 w-7" />,
    color: "bg-purple-500/10",
    textColor: "text-purple-600 dark:text-purple-400",
    borderColor: "border-purple-500/30",
    docsUrl: "https://developers.viber.com/docs/api/rest-bot-api/",
    credentialFields: [
      { key: "auth_token", label: "Auth Token", placeholder: "xxxxxx-xxxxxxxxxx-xxxxx", type: "password", hint: "From the Viber Developer Portal after creating a bot account" },
      { key: "bot_name",   label: "Bot Name",   placeholder: "My Shop Bot",             hint: "The name of your Viber bot" },
    ],
    setupSteps: [
      { title: "Create a Viber bot",     description: "Log in to the Viber Developer Portal and create a new bot account." },
      { title: "Get your auth token",    description: "Copy the auth token from your bot's dashboard." },
      { title: "Paste & save",           description: "Enter the token above and click Save Credentials." },
      { title: "Webhook auto-registers", description: "OctaDezx automatically sets up the Viber webhook for you." },
    ],
  },
  {
    id: "line",
    category: "Messaging",
    integrationType: "messaging",
    name: "LINE",
    tagline: "Connect with LINE's 200M+ users in Asia",
    icon: <MessageSquare className="h-7 w-7" />,
    color: "bg-lime-500/10",
    textColor: "text-lime-600 dark:text-lime-500",
    borderColor: "border-lime-500/30",
    docsUrl: "https://developers.line.biz/en/docs/messaging-api/",
    credentialFields: [
      { key: "channel_access_token", label: "Channel Access Token", placeholder: "xxxx...", type: "password", hint: "Long-lived token from LINE Developer Console → Messaging API" },
      { key: "channel_secret",       label: "Channel Secret",       placeholder: "abc123...", type: "password", hint: "Found in LINE Developer Console → Basic Settings → Channel secret" },
    ],
    setupSteps: [
      { title: "Create a Messaging API channel", description: "Go to LINE Developer Console, create a provider and add a Messaging API channel." },
      { title: "Generate an access token",       description: "In your channel settings, issue a long-lived channel access token." },
      { title: "Paste credentials",              description: "Enter the token and secret above." },
      { title: "Configure webhook URL",          description: "In LINE Developer Console → Messaging API → Webhook settings, paste the Webhook URL below." },
    ],
  },
  {
    id: "twitter",
    category: "Messaging",
    integrationType: "messaging",
    name: "Twitter / X DM",
    tagline: "Auto-reply to Twitter/X Direct Messages",
    icon: <TwitterXIcon />,
    color: "bg-neutral-500/10",
    textColor: "text-neutral-700 dark:text-neutral-300",
    borderColor: "border-neutral-500/30",
    docsUrl: "https://developer.twitter.com/en/docs/twitter-api/direct-messages/introduction",
    credentialFields: [
      { key: "bearer_token",        label: "Bearer Token",        placeholder: "AAAA...", type: "password", hint: "From Twitter Developer Portal → Keys and Tokens" },
      { key: "api_key",             label: "API Key",             placeholder: "xxxxxx",  type: "password" },
      { key: "api_secret",          label: "API Key Secret",      placeholder: "xxxxxx",  type: "password" },
      { key: "access_token",        label: "Access Token",        placeholder: "xxxxxx",  type: "password" },
      { key: "access_token_secret", label: "Access Token Secret", placeholder: "xxxxxx",  type: "password" },
    ],
    setupSteps: [
      { title: "Create a Twitter Developer App", description: "Go to developer.twitter.com, apply for Elevated access and create an App." },
      { title: "Enable DM permissions",          description: "In your App settings, enable Read/Write/DM permissions and regenerate tokens." },
      { title: "Set up Account Activity API",    description: "Subscribe to the Account Activity API (Premium/Enterprise) to receive DM webhooks." },
      { title: "Paste credentials & save",       description: "Enter all your app credentials and click Save." },
    ],
  },
  {
    id: "wechat",
    category: "Messaging",
    integrationType: "messaging",
    name: "WeChat",
    tagline: "Automate WeChat Official Account messages",
    icon: <MessageCircle className="h-7 w-7" />,
    color: "bg-green-600/10",
    textColor: "text-green-700 dark:text-green-400",
    borderColor: "border-green-600/30",
    docsUrl: "https://developers.weixin.qq.com/doc/offiaccount/en/Getting_Started/Overview.html",
    credentialFields: [
      { key: "app_id",     label: "App ID",     placeholder: "wx...",   hint: "WeChat Official Account App ID" },
      { key: "app_secret", label: "App Secret", placeholder: "xxxxxx",  type: "password" },
      { key: "token",      label: "Token",      placeholder: "xxxxxx",  hint: "The token you set in WeChat Official Account platform" },
    ],
    setupSteps: [
      { title: "Register an Official Account", description: "Apply for a WeChat Official Account (Subscription or Service account) at mp.weixin.qq.com." },
      { title: "Enable developer mode",        description: "In Settings → Developer settings, enable developer mode and note your App ID and App Secret." },
      { title: "Paste credentials",            description: "Enter your App ID, App Secret, and Token above." },
      { title: "Configure server URL",         description: "In WeChat Official Account platform, set the Server URL to the Webhook URL shown below." },
    ],
  },
  {
    id: "discord",
    category: "Messaging",
    integrationType: "messaging",
    name: "Discord",
    tagline: "AI-powered slash commands for your Discord server",
    icon: <DiscordIcon />,
    color: "bg-indigo-500/10",
    textColor: "text-indigo-600 dark:text-indigo-400",
    borderColor: "border-indigo-500/30",
    docsUrl: "https://discord.com/developers/docs/interactions/overview",
    credentialFields: [
      { key: "bot_token",   label: "Bot Token",        placeholder: "MTxxxxxx.xxxxxx.xxxxxx", type: "password", hint: "From Discord Developer Portal → Your App → Bot → Token" },
      { key: "client_id",   label: "Application ID",   placeholder: "123456789012345678",     hint: "From Discord Developer Portal → General Information → Application ID" },
      { key: "public_key",  label: "Public Key",       placeholder: "abc123def456...",        hint: "From Discord Developer Portal → General Information → Public Key (for request verification)" },
    ],
    setupSteps: [
      { title: "Create a Discord App",         description: "Go to discord.com/developers, create a New Application." },
      { title: "Add a Bot",                    description: "Under the Bot tab, click Add Bot. Copy your Bot Token." },
      { title: "Set Interactions Endpoint",    description: "In General Information → Interactions Endpoint URL, paste the Webhook URL shown below. Discord will verify it using your Public Key." },
      { title: "Invite bot to your server",   description: "Under OAuth2 → URL Generator, select bot + applications.commands scopes. Copy the URL and invite the bot." },
      { title: "Paste credentials & save",    description: "Enter your Bot Token, Application ID, and Public Key." },
    ],
  },
  {
    id: "slack",
    category: "Messaging",
    integrationType: "messaging",
    name: "Slack",
    tagline: "Deploy AI in your Slack workspace",
    icon: <SlackIcon />,
    color: "bg-yellow-500/10",
    textColor: "text-yellow-700 dark:text-yellow-400",
    borderColor: "border-yellow-500/30",
    docsUrl: "https://api.slack.com/start",
    credentialFields: [
      { key: "bot_token",       label: "Bot OAuth Token",     placeholder: "xoxb-...", type: "password", hint: "From api.slack.com → Your App → OAuth & Permissions → Bot User OAuth Token" },
      { key: "signing_secret",  label: "Signing Secret",      placeholder: "xxxxxx",   type: "password", hint: "From Your App → Basic Information → App Credentials → Signing Secret" },
      { key: "channel_id",      label: "Channel ID",          placeholder: "C0xxxxxxx", hint: "Open channel → View channel details → Copy the Channel ID at the bottom" },
    ],
    setupSteps: [
      { title: "Create a Slack App",        description: "Go to api.slack.com/apps, create a new app in your workspace." },
      { title: "Add scopes & install",      description: "Add bot scopes: chat:write, channels:history, app_mentions:read. Install to workspace." },
      { title: "Enable Event Subscriptions",description: "In Event Subscriptions, paste the Webhook URL shown below and subscribe to message.channels events." },
      { title: "Paste credentials & save",  description: "Enter your Bot OAuth Token, Signing Secret, and target Channel ID." },
    ],
  },

  /* ── E-COMMERCE ─────────────────────────────────────────────── */
  {
    id: "shopify",
    category: "E-Commerce",
    integrationType: "ecommerce",
    name: "Shopify",
    tagline: "Sync products, orders & customers from Shopify",
    icon: <ShopifyIcon />,
    color: "bg-green-500/10",
    textColor: "text-green-700 dark:text-green-400",
    borderColor: "border-green-500/30",
    docsUrl: "https://shopify.dev/docs/api/admin-rest",
    syncs: ["Product catalogue & inventory", "Orders & fulfilment status", "Customer profiles", "Cart abandonment events"],
    credentialFields: [
      { key: "store_url",   label: "Store URL",   placeholder: "your-store.myshopify.com", hint: "Your Shopify store domain (without https://)" },
      { key: "api_key",     label: "Admin API Access Token", placeholder: "shpat_xxxxxx", type: "password", hint: "From Shopify Admin → Settings → Apps → Develop apps → Create an app → Admin API access token" },
    ],
    setupSteps: [
      { title: "Enable custom apps",    description: "In Shopify Admin → Settings → Apps and sales channels → Develop apps → Allow custom app development." },
      { title: "Create an app",         description: "Click 'Create an app', name it 'OctaDezx', then click 'Configure Admin API scopes'." },
      { title: "Set API scopes",        description: "Enable: read_products, read_orders, read_customers, write_orders. Save and install the app." },
      { title: "Copy access token",     description: "After installing, reveal and copy the Admin API access token (shown once only)." },
      { title: "Paste credentials",     description: "Enter your store URL and access token above, then click Save." },
    ],
  },
  {
    id: "woocommerce",
    category: "E-Commerce",
    integrationType: "ecommerce",
    name: "WooCommerce",
    tagline: "Connect your WordPress/WooCommerce store",
    icon: <WooCommerceIcon />,
    color: "bg-purple-500/10",
    textColor: "text-purple-700 dark:text-purple-400",
    borderColor: "border-purple-500/30",
    docsUrl: "https://woocommerce.github.io/woocommerce-rest-api-docs/",
    syncs: ["Products & stock levels", "Orders & shipping status", "Customer data", "Refunds & returns"],
    credentialFields: [
      { key: "store_url",        label: "Store URL",        placeholder: "https://yourstore.com",  hint: "Your WordPress site URL (with https://)" },
      { key: "consumer_key",     label: "Consumer Key",     placeholder: "ck_xxxxxxxxxxxxxx",       type: "password", hint: "From WooCommerce → Settings → Advanced → REST API → Add key" },
      { key: "consumer_secret",  label: "Consumer Secret",  placeholder: "cs_xxxxxxxxxxxxxx",       type: "password", hint: "Generated alongside the Consumer Key — copy it immediately, shown once" },
    ],
    setupSteps: [
      { title: "Open WooCommerce API settings", description: "In your WordPress admin, go to WooCommerce → Settings → Advanced → REST API." },
      { title: "Add a new key",                 description: "Click 'Add key'. Set Description to 'OctaDezx', User to your admin user, Permissions to 'Read/Write'." },
      { title: "Copy credentials",              description: "Click 'Generate API key' and copy both Consumer Key and Consumer Secret (shown once)." },
      { title: "Paste credentials",             description: "Enter your Store URL, Consumer Key and Consumer Secret above, then click Save." },
    ],
  },
  {
    id: "amazon",
    category: "E-Commerce",
    integrationType: "ecommerce",
    name: "Amazon Seller",
    tagline: "Sync Amazon listings, orders & FBA inventory",
    icon: <AmazonIcon />,
    color: "bg-orange-500/10",
    textColor: "text-orange-600 dark:text-orange-400",
    borderColor: "border-orange-500/30",
    docsUrl: "https://developer-docs.amazon.com/sp-api/docs",
    syncs: ["Product listings & FBA inventory", "Orders & shipments", "Returns & refunds", "Customer messages"],
    credentialFields: [
      { key: "seller_id",    label: "Seller ID",    placeholder: "AXXXXXXXXXXXXX",  hint: "From Seller Central → Account Info → Business Information" },
      { key: "marketplace",  label: "Marketplace",  placeholder: "ATVPDKIKX0DER",   hint: "Marketplace ID (US = ATVPDKIKX0DER, UK = A1F83G8C2ARO7P, etc.)" },
      { key: "lwa_app_id",   label: "LWA App ID",   placeholder: "amzn1.application...", type: "password" },
      { key: "lwa_secret",   label: "LWA Client Secret", placeholder: "xxxxxx",     type: "password" },
      { key: "refresh_token",label: "Refresh Token",placeholder: "Atzr|...",        type: "password", hint: "Generated during SP-API authorization flow" },
    ],
    setupSteps: [
      { title: "Register in Amazon Developer",  description: "Go to developer.amazon.com, create an IAM user with SP-API permissions." },
      { title: "Create a developer application", description: "In Seller Central → Partner Network → Develop Apps, register a new application." },
      { title: "Authorize the application",     description: "Complete the OAuth flow to get your Refresh Token." },
      { title: "Paste credentials",             description: "Enter your Seller ID, Marketplace ID, LWA credentials, and Refresh Token." },
    ],
  },
  {
    id: "etsy",
    category: "E-Commerce",
    integrationType: "ecommerce",
    name: "Etsy",
    tagline: "Manage your Etsy shop orders & listings",
    icon: <Tag className="h-7 w-7" />,
    color: "bg-orange-500/10",
    textColor: "text-orange-700 dark:text-orange-400",
    borderColor: "border-orange-500/30",
    docsUrl: "https://developers.etsy.com/documentation/",
    syncs: ["Listings & inventory", "Orders & shipping", "Customer messages", "Shop stats"],
    credentialFields: [
      { key: "api_key",     label: "API Key",     placeholder: "xxxxxxxxxxxxxx", hint: "From Etsy Developer portal → Your Apps → API Key" },
      { key: "shop_id",     label: "Shop ID",     placeholder: "12345678",       hint: "Your numeric Etsy shop ID" },
      { key: "access_token",label: "Access Token",placeholder: "xxxxxx",         type: "password", hint: "OAuth2 access token after authorizing your app" },
    ],
    setupSteps: [
      { title: "Create an Etsy app",     description: "Go to developers.etsy.com, sign in and create a new application." },
      { title: "Get your API key",       description: "Copy the API Key from your app's details page." },
      { title: "Complete OAuth flow",    description: "Use the OAuth2 flow to authorize your shop and obtain an access token." },
      { title: "Paste credentials",      description: "Enter your API Key, Shop ID and Access Token, then click Save." },
    ],
  },
  {
    id: "ebay",
    category: "E-Commerce",
    integrationType: "ecommerce",
    name: "eBay",
    tagline: "Sync eBay listings and orders automatically",
    icon: <Store className="h-7 w-7" />,
    color: "bg-blue-500/10",
    textColor: "text-blue-600 dark:text-blue-400",
    borderColor: "border-blue-500/30",
    docsUrl: "https://developer.ebay.com/develop/apis",
    syncs: ["Item listings & inventory", "Orders & tracking", "Buyer messages", "Returns"],
    credentialFields: [
      { key: "app_id",       label: "App ID (Client ID)", placeholder: "YourName-AppName-...",   hint: "From eBay Developers Program → Application Keys" },
      { key: "cert_id",      label: "Cert ID (Client Secret)", placeholder: "xxxxxx",            type: "password" },
      { key: "user_token",   label: "User Access Token",  placeholder: "v^1.1#i^1#...",          type: "password", hint: "OAuth user token with selling and messaging scope" },
    ],
    setupSteps: [
      { title: "Join eBay Developers Program", description: "Register at developer.ebay.com and create an application to get App ID and Cert ID." },
      { title: "Generate a user token",        description: "Use the OAuth Authorization Code flow to get a user access token for your seller account." },
      { title: "Paste credentials & save",     description: "Enter your App ID, Cert ID and user token." },
    ],
  },
  {
    id: "bigcommerce",
    category: "E-Commerce",
    integrationType: "ecommerce",
    name: "BigCommerce",
    tagline: "Connect your BigCommerce storefront",
    icon: <Building2 className="h-7 w-7" />,
    color: "bg-blue-600/10",
    textColor: "text-blue-700 dark:text-blue-400",
    borderColor: "border-blue-600/30",
    docsUrl: "https://developer.bigcommerce.com/docs/start/authentication",
    syncs: ["Products & variants", "Orders & fulfilment", "Customers", "Abandoned carts"],
    credentialFields: [
      { key: "store_hash",  label: "Store Hash",  placeholder: "abc123def",            hint: "Found in your BigCommerce store URL: store-{hash}.mybigcommerce.com" },
      { key: "access_token",label: "Access Token",placeholder: "xxxxxxxxxxxxxx",       type: "password", hint: "From BigCommerce Admin → Settings → API → Store-level API accounts" },
    ],
    setupSteps: [
      { title: "Create an API account",  description: "In BigCommerce Admin → Settings → API → Store-level API accounts, create a new account." },
      { title: "Set scopes",             description: "Grant: Products (Read), Orders (Read/Write), Customers (Read), Carts (Read)." },
      { title: "Paste credentials",      description: "Enter your Store Hash and the generated Access Token." },
    ],
  },
  {
    id: "magento",
    category: "E-Commerce",
    integrationType: "ecommerce",
    name: "Magento / Adobe Commerce",
    tagline: "Sync your Magento store catalogue & orders",
    icon: <Package2 className="h-7 w-7" />,
    color: "bg-red-500/10",
    textColor: "text-red-600 dark:text-red-400",
    borderColor: "border-red-500/30",
    docsUrl: "https://developer.adobe.com/commerce/webapi/rest/",
    syncs: ["Products & categories", "Orders & invoices", "Customer accounts", "CMS content"],
    credentialFields: [
      { key: "base_url",      label: "Store Base URL", placeholder: "https://yourstore.com",  hint: "Your Magento store's base URL" },
      { key: "access_token",  label: "REST API Token",  placeholder: "xxxxxxxxxxxxxx",         type: "password", hint: "From Magento Admin → System → Integrations → Create new integration" },
    ],
    setupSteps: [
      { title: "Create an Integration", description: "In Magento Admin → System → Extensions → Integrations, click Add New Integration." },
      { title: "Set API permissions",   description: "Under API tab, grant read access to Catalog, Sales, Customers resources." },
      { title: "Activate integration",  description: "Save, activate, and allow access. Copy the Access Token shown." },
      { title: "Paste credentials",     description: "Enter your Store URL and Access Token." },
    ],
  },
  {
    id: "lazada",
    category: "E-Commerce",
    integrationType: "ecommerce",
    name: "Lazada",
    tagline: "Manage Lazada orders across Southeast Asia",
    icon: <Package className="h-7 w-7" />,
    color: "bg-blue-500/10",
    textColor: "text-blue-600 dark:text-blue-400",
    borderColor: "border-blue-500/30",
    docsUrl: "https://open.lazada.com/doc/doc.htm",
    syncs: ["Product listings", "Orders & logistics", "Customer chats", "Promotions"],
    credentialFields: [
      { key: "app_key",     label: "App Key",     placeholder: "123456",    hint: "From Lazada Open Platform → My Apps" },
      { key: "app_secret",  label: "App Secret",  placeholder: "xxxxxx",    type: "password" },
      { key: "access_token",label: "Access Token",placeholder: "50000...",  type: "password", hint: "Generated through Lazada's OAuth authorization flow" },
    ],
    setupSteps: [
      { title: "Register on Lazada Open Platform", description: "Go to open.lazada.com, register as a developer, and create an App." },
      { title: "Complete seller authorization",    description: "Use the OAuth flow to connect your Lazada seller account and obtain an Access Token." },
      { title: "Paste credentials",               description: "Enter your App Key, App Secret, and Access Token." },
    ],
  },
  {
    id: "shopee",
    category: "E-Commerce",
    integrationType: "ecommerce",
    name: "Shopee",
    tagline: "Automate Shopee store management & chat",
    icon: <ShoppingBag className="h-7 w-7" />,
    color: "bg-orange-500/10",
    textColor: "text-orange-600 dark:text-orange-400",
    borderColor: "border-orange-500/30",
    docsUrl: "https://open.shopee.com/documents",
    syncs: ["Product catalogue", "Orders & shipping", "In-app chat", "Vouchers & promotions"],
    credentialFields: [
      { key: "partner_id",  label: "Partner ID",    placeholder: "123456",   hint: "From Shopee Open Platform → My Apps → Partner ID" },
      { key: "partner_key", label: "Partner Key",   placeholder: "xxxxxx",   type: "password" },
      { key: "shop_id",     label: "Shop ID",       placeholder: "123456",   hint: "Your Shopee seller shop ID" },
      { key: "access_token",label: "Access Token",  placeholder: "xxxxxx",   type: "password" },
    ],
    setupSteps: [
      { title: "Apply for API access",        description: "Register as a developer on open.shopee.com and create an app." },
      { title: "Authorize your shop",         description: "Use the OAuth flow to link your Shopee seller shop and get an Access Token." },
      { title: "Paste credentials",           description: "Enter your Partner ID, Partner Key, Shop ID and Access Token." },
    ],
  },
  {
    id: "tokopedia",
    category: "E-Commerce",
    integrationType: "ecommerce",
    name: "Tokopedia",
    tagline: "Connect your Tokopedia seller account",
    icon: <ShoppingCart className="h-7 w-7" />,
    color: "bg-green-600/10",
    textColor: "text-green-700 dark:text-green-400",
    borderColor: "border-green-600/30",
    docsUrl: "https://developer.tokopedia.com/openapi/guide/",
    syncs: ["Products & stock", "Orders", "Customer messages", "Shop stats"],
    credentialFields: [
      { key: "client_id",     label: "Client ID",     placeholder: "xxxxxx", hint: "From Tokopedia Seller Dashboard → Developer Tools" },
      { key: "client_secret", label: "Client Secret", placeholder: "xxxxxx", type: "password" },
      { key: "fs_id",         label: "FS ID",         placeholder: "12345",  hint: "Your Tokopedia Fulfilled Store ID" },
    ],
    setupSteps: [
      { title: "Register for API access", description: "Apply for API access through Tokopedia's Seller Developer Program." },
      { title: "Get your credentials",    description: "From Seller Dashboard → Developer Tools, note your Client ID and Client Secret." },
      { title: "Paste credentials",       description: "Enter your Client ID, Client Secret, and FS ID." },
    ],
  },

  /* ── CRM & HELPDESK ─────────────────────────────────────────── */
  {
    id: "hubspot",
    category: "CRM & Helpdesk",
    integrationType: "crm",
    name: "HubSpot",
    tagline: "Sync contacts, deals & support tickets",
    icon: <HubSpotIcon />,
    color: "bg-orange-500/10",
    textColor: "text-orange-600 dark:text-orange-400",
    borderColor: "border-orange-500/30",
    docsUrl: "https://developers.hubspot.com/",
    syncs: ["Contacts & companies", "Deals & pipeline", "Support tickets", "Chat conversations", "Email sequences"],
    credentialFields: [
      { key: "private_app_token", label: "Private App Access Token", placeholder: "pat-na1-xxxxxx", type: "password", hint: "From HubSpot → Settings → Integrations → Private Apps → Create private app" },
      { key: "portal_id",         label: "Hub ID (Portal ID)",       placeholder: "12345678",       hint: "Found in HubSpot top-right account menu" },
    ],
    setupSteps: [
      { title: "Create a Private App", description: "In HubSpot → Settings → Integrations → Private Apps, click 'Create a private app'." },
      { title: "Set scopes",           description: "Enable CRM scopes: crm.objects.contacts.read, crm.objects.deals.read, conversations.read." },
      { title: "Generate token",       description: "Create the app and copy the Access Token." },
      { title: "Paste credentials",    description: "Enter your Access Token and Hub ID, then click Save." },
    ],
  },
  {
    id: "salesforce",
    category: "CRM & Helpdesk",
    integrationType: "crm",
    name: "Salesforce CRM",
    tagline: "Connect your Salesforce org for full CRM sync",
    icon: <Cloud className="h-7 w-7" />,
    color: "bg-blue-500/10",
    textColor: "text-blue-600 dark:text-blue-400",
    borderColor: "border-blue-500/30",
    docsUrl: "https://developer.salesforce.com/docs",
    syncs: ["Leads & contacts", "Opportunities & accounts", "Cases & service tickets", "Activity history"],
    credentialFields: [
      { key: "instance_url",    label: "Instance URL",    placeholder: "https://yourorg.salesforce.com", hint: "Your Salesforce org URL" },
      { key: "client_id",       label: "Consumer Key",    placeholder: "3MVG9...",                       hint: "From Connected App settings" },
      { key: "client_secret",   label: "Consumer Secret", placeholder: "xxxxxx",                         type: "password" },
      { key: "refresh_token",   label: "Refresh Token",   placeholder: "5Aep861...",                     type: "password", hint: "Obtained through OAuth 2.0 Web Server flow" },
    ],
    setupSteps: [
      { title: "Create a Connected App", description: "In Salesforce Setup → App Manager → New Connected App. Enable OAuth Settings, add callback URL." },
      { title: "Set OAuth scopes",       description: "Add scopes: api, refresh_token, offline_access." },
      { title: "Authorize",             description: "Complete the OAuth Web Server flow to obtain a Refresh Token." },
      { title: "Paste credentials",     description: "Enter Instance URL, Consumer Key, Consumer Secret, and Refresh Token." },
    ],
  },
  {
    id: "zoho",
    category: "CRM & Helpdesk",
    integrationType: "crm",
    name: "Zoho CRM",
    tagline: "Sync leads, contacts and deals from Zoho CRM",
    icon: <Users className="h-7 w-7" />,
    color: "bg-red-500/10",
    textColor: "text-red-600 dark:text-red-400",
    borderColor: "border-red-500/30",
    docsUrl: "https://www.zoho.com/crm/developer/docs/api/v7/",
    syncs: ["Leads & contacts", "Deals & pipeline", "Activities", "Emails & calls"],
    credentialFields: [
      { key: "client_id",     label: "Client ID",     placeholder: "1000.xxxxx",  hint: "From Zoho API Console → Self Client or OAuth app" },
      { key: "client_secret", label: "Client Secret", placeholder: "xxxxxx",       type: "password" },
      { key: "refresh_token", label: "Refresh Token", placeholder: "1000.xxxxx",   type: "password" },
      { key: "data_center",   label: "Data Center",   placeholder: "com",           hint: "Your Zoho data center: com, eu, in, au, jp, ca" },
    ],
    setupSteps: [
      { title: "Register an app",     description: "Go to api-console.zoho.com, create a Server-based Application." },
      { title: "Generate OAuth grant",description: "Use the Self Client option in API Console to get a grant token with ZohoCRM.modules.all scope." },
      { title: "Exchange for tokens", description: "Exchange the grant token for access + refresh tokens using the Zoho OAuth endpoint." },
      { title: "Paste credentials",   description: "Enter Client ID, Client Secret, Refresh Token, and your data center." },
    ],
  },
  {
    id: "zendesk",
    category: "CRM & Helpdesk",
    integrationType: "crm",
    name: "Zendesk",
    tagline: "Create & update support tickets automatically",
    icon: <Headphones className="h-7 w-7" />,
    color: "bg-green-500/10",
    textColor: "text-green-700 dark:text-green-400",
    borderColor: "border-green-500/30",
    docsUrl: "https://developer.zendesk.com/api-reference/",
    syncs: ["Support tickets", "Customer profiles", "Chat transcripts", "CSAT scores", "Agent assignments"],
    credentialFields: [
      { key: "subdomain",  label: "Subdomain",  placeholder: "yourcompany", hint: "The part before .zendesk.com in your URL" },
      { key: "email",      label: "Agent Email", placeholder: "agent@yourcompany.com" },
      { key: "api_token",  label: "API Token",  placeholder: "xxxxxxxxxxxxxx", type: "password", hint: "From Zendesk Admin Center → Channels → API → API Token" },
    ],
    setupSteps: [
      { title: "Enable API token access", description: "In Zendesk Admin Center → Apps and Integrations → Zendesk API → enable Token Access." },
      { title: "Generate a token",        description: "Click 'Add API token', give it a description, copy the token (shown once)." },
      { title: "Paste credentials",       description: "Enter your subdomain, agent email, and the API token." },
    ],
  },
  {
    id: "freshdesk",
    category: "CRM & Helpdesk",
    integrationType: "crm",
    name: "Freshdesk",
    tagline: "Manage support tickets through Freshdesk",
    icon: <LifeBuoy className="h-7 w-7" />,
    color: "bg-teal-500/10",
    textColor: "text-teal-600 dark:text-teal-400",
    borderColor: "border-teal-500/30",
    docsUrl: "https://developers.freshdesk.com/api/",
    syncs: ["Tickets & replies", "Contact profiles", "Agent notes", "CSAT feedback"],
    credentialFields: [
      { key: "domain",   label: "Domain",   placeholder: "yourcompany.freshdesk.com", hint: "Your Freshdesk portal URL" },
      { key: "api_key",  label: "API Key",  placeholder: "xxxxxxxxxxxxxx", type: "password", hint: "From Freshdesk Profile Settings → API Key (top-right avatar menu)" },
    ],
    setupSteps: [
      { title: "Get your API key",    description: "Log into Freshdesk, click your avatar (top right) → Profile settings → scroll down to API Key." },
      { title: "Paste credentials",   description: "Enter your Freshdesk domain URL and API Key, then click Save." },
    ],
  },
  {
    id: "intercom",
    category: "CRM & Helpdesk",
    integrationType: "crm",
    name: "Intercom",
    tagline: "Sync Intercom conversations & contacts",
    icon: <MessageCircle className="h-7 w-7" />,
    color: "bg-blue-500/10",
    textColor: "text-blue-600 dark:text-blue-400",
    borderColor: "border-blue-500/30",
    docsUrl: "https://developers.intercom.com/docs",
    syncs: ["Conversations & messages", "Contacts & leads", "Companies", "Custom attributes"],
    credentialFields: [
      { key: "access_token", label: "Access Token", placeholder: "dG9rOjxxxxxx", type: "password", hint: "From Intercom Developer Hub → Your App → Authentication → Access Token" },
    ],
    setupSteps: [
      { title: "Create an Intercom app", description: "Go to app.intercom.com → Settings → Developers → Your apps, create a new integration app." },
      { title: "Get the access token",   description: "In your app, go to Authentication and copy the Access Token." },
      { title: "Paste & save",           description: "Enter your Access Token and click Save." },
    ],
  },

  /* ── PAYMENTS ───────────────────────────────────────────────── */
  {
    id: "stripe",
    category: "Payments",
    integrationType: "payment",
    name: "Stripe",
    tagline: "Track payments, refunds & subscription events",
    icon: <StripeIcon />,
    color: "bg-violet-500/10",
    textColor: "text-violet-600 dark:text-violet-400",
    borderColor: "border-violet-500/30",
    docsUrl: "https://stripe.com/docs/api",
    syncs: ["Payment intents & charges", "Subscriptions & invoices", "Refunds", "Dispute alerts", "Customer data"],
    credentialFields: [
      { key: "secret_key",      label: "Secret Key",       placeholder: "sk_live_xxxxxxxx", type: "password", hint: "From Stripe Dashboard → Developers → API keys → Secret key" },
      { key: "webhook_secret",  label: "Webhook Secret",   placeholder: "whsec_xxxxxxxx",   type: "password", hint: "From Stripe Dashboard → Developers → Webhooks → Signing secret" },
    ],
    setupSteps: [
      { title: "Get your API keys", description: "In Stripe Dashboard → Developers → API keys, reveal and copy your Secret key." },
      { title: "Create a webhook",  description: "In Developers → Webhooks → Add endpoint. Paste the Webhook URL shown below. Select events: payment_intent.*, charge.*, customer.*" },
      { title: "Copy signing secret",description: "After creating the webhook, reveal and copy the Signing Secret." },
      { title: "Paste credentials", description: "Enter your Secret Key and Webhook Secret, then click Save." },
    ],
  },
  {
    id: "paypal",
    category: "Payments",
    integrationType: "payment",
    name: "PayPal",
    tagline: "Receive PayPal payment & dispute notifications",
    icon: <PayPalIcon />,
    color: "bg-blue-500/10",
    textColor: "text-blue-700 dark:text-blue-400",
    borderColor: "border-blue-500/30",
    docsUrl: "https://developer.paypal.com/api/rest/",
    syncs: ["Payments & captures", "Refunds & disputes", "Subscriptions", "Invoice events"],
    credentialFields: [
      { key: "client_id",     label: "Client ID",     placeholder: "AXxxxxxx", hint: "From PayPal Developer Dashboard → My Apps & Credentials → Live → Client ID" },
      { key: "client_secret", label: "Client Secret", placeholder: "ELxxxxxx", type: "password" },
    ],
    setupSteps: [
      { title: "Create a PayPal app",   description: "Go to developer.paypal.com → My Apps & Credentials → Create App (Live mode)." },
      { title: "Enable webhook events", description: "In your app, under Webhooks, add the Webhook URL shown below. Subscribe to: PAYMENT.CAPTURE.COMPLETED, CUSTOMER.DISPUTE.*, BILLING.SUBSCRIPTION.*" },
      { title: "Paste credentials",     description: "Enter your Client ID and Client Secret, then click Save." },
    ],
  },
  {
    id: "square",
    category: "Payments",
    integrationType: "payment",
    name: "Square",
    tagline: "Sync Square POS orders & payment events",
    icon: <CreditCard className="h-7 w-7" />,
    color: "bg-neutral-500/10",
    textColor: "text-neutral-700 dark:text-neutral-300",
    borderColor: "border-neutral-500/30",
    docsUrl: "https://developer.squareup.com/reference/square",
    syncs: ["Orders & payments", "Inventory levels", "Customer directory", "Subscription events"],
    credentialFields: [
      { key: "access_token",   label: "Access Token",   placeholder: "EAAAxxxxxxxxxxxx", type: "password", hint: "From Square Developer Console → Credentials → Production Access Token" },
      { key: "location_id",    label: "Location ID",    placeholder: "LxxxxxxxxxxxxxxX",  hint: "From Square Dashboard → Account → Business locations → Location ID" },
      { key: "webhook_secret", label: "Webhook Signature Key", placeholder: "xxxxxx",     type: "password", hint: "From Square Developer Console → Webhooks → Signature Key" },
    ],
    setupSteps: [
      { title: "Create a Square App",    description: "Go to developer.squareup.com, create a new application. Copy the Production Access Token." },
      { title: "Create a webhook",       description: "In your app → Webhooks → Add webhook subscription. Paste the Webhook URL shown below. Choose events: payment.created, order.fulfilled, refund.*" },
      { title: "Copy signature key",     description: "Copy the webhook Signature Key shown after creation." },
      { title: "Paste credentials",      description: "Enter your Access Token, Location ID, and Signature Key." },
    ],
  },

  // Couriers are appended below (after COURIER_DEFS is initialized — avoids TDZ on const).
];

/* ──────────────────────────────────────────────────────────────────
   Courier builder — compact definition → full PlatformConfig
────────────────────────────────────────────────────────────────── */
type CourierColor = "blue" | "cyan" | "indigo" | "violet" | "fuchsia" | "pink" | "rose" | "red" | "orange" | "amber" | "yellow" | "lime" | "green" | "emerald" | "teal" | "sky" | "slate";

const COURIER_COLOR_CLASSES: Record<CourierColor, { bg: string; text: string; border: string }> = {
  blue:    { bg: "bg-blue-500/10",    text: "text-blue-600 dark:text-blue-400",       border: "border-blue-500/30" },
  cyan:    { bg: "bg-cyan-500/10",    text: "text-cyan-600 dark:text-cyan-400",       border: "border-cyan-500/30" },
  indigo:  { bg: "bg-indigo-500/10",  text: "text-indigo-600 dark:text-indigo-400",   border: "border-indigo-500/30" },
  violet:  { bg: "bg-violet-500/10",  text: "text-violet-600 dark:text-violet-400",   border: "border-violet-500/30" },
  fuchsia: { bg: "bg-fuchsia-500/10", text: "text-fuchsia-600 dark:text-fuchsia-400", border: "border-fuchsia-500/30" },
  pink:    { bg: "bg-pink-500/10",    text: "text-pink-600 dark:text-pink-400",       border: "border-pink-500/30" },
  rose:    { bg: "bg-rose-500/10",    text: "text-rose-600 dark:text-rose-400",       border: "border-rose-500/30" },
  red:     { bg: "bg-red-500/10",     text: "text-red-600 dark:text-red-400",         border: "border-red-500/30" },
  orange:  { bg: "bg-orange-500/10",  text: "text-orange-600 dark:text-orange-400",   border: "border-orange-500/30" },
  amber:   { bg: "bg-amber-500/10",   text: "text-amber-600 dark:text-amber-400",     border: "border-amber-500/30" },
  yellow:  { bg: "bg-yellow-500/10",  text: "text-yellow-700 dark:text-yellow-400",   border: "border-yellow-500/30" },
  lime:    { bg: "bg-lime-500/10",    text: "text-lime-600 dark:text-lime-400",       border: "border-lime-500/30" },
  green:   { bg: "bg-green-500/10",   text: "text-green-600 dark:text-green-400",     border: "border-green-500/30" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30" },
  teal:    { bg: "bg-teal-500/10",    text: "text-teal-600 dark:text-teal-400",       border: "border-teal-500/30" },
  sky:     { bg: "bg-sky-500/10",     text: "text-sky-600 dark:text-sky-400",         border: "border-sky-500/30" },
  slate:   { bg: "bg-slate-500/10",   text: "text-slate-600 dark:text-slate-400",     border: "border-slate-500/30" },
};

interface CourierDef {
  id: string;
  name: string;
  tagline: string;
  color: CourierColor;
  iconType?: "truck" | "plane" | "ship" | "globe" | "map";
  docsUrl?: string;
  fields: Array<[key: string, label: string, isSecret?: boolean, placeholder?: string, hint?: string]>;
  setupNotes?: string;
}

const COURIER_DEFS: CourierDef[] = [
  // ── Global Aggregators (cover hundreds of carriers) ──
  { id: "easypost",  name: "EasyPost",  tagline: "100+ couriers worldwide via one API",      color: "blue",   iconType: "globe", docsUrl: "https://www.easypost.com/docs/api",
    fields: [["api_key", "Production API Key", true, "EZTK...", "EasyPost dashboard → API Keys → Production Key"]],
    setupNotes: "Recommended for US/EU shipping — covers USPS, UPS, FedEx, DHL, Canada Post and 100+ more."
  },
  { id: "shippo",    name: "Shippo",    tagline: "US-focused shipping aggregator",            color: "violet", iconType: "globe", docsUrl: "https://goshippo.com/docs/",
    fields: [["api_token", "API Token", true, "shippo_live_...", "Shippo → Settings → API"]]
  },
  { id: "aftership", name: "AfterShip", tagline: "Universal tracker — 1000+ carriers",         color: "amber",  iconType: "globe", docsUrl: "https://www.aftership.com/docs/api/4",
    fields: [["api_key", "API Key", true, "asat_...", "AfterShip → Settings → API"]],
    setupNotes: "Tracker only (doesn't print labels). Provides auto-tracking for any tracking number, worldwide."
  },
  { id: "shiprocket", name: "ShipRocket", tagline: "India aggregator — 17+ couriers",          color: "rose",   iconType: "globe", docsUrl: "https://apidocs.shiprocket.in/",
    fields: [["email", "Account Email"], ["password", "Password", true]]
  },

  // ── Bangladesh ──
  { id: "pathao",    name: "Pathao Courier",   tagline: "Bangladesh's leading delivery network", color: "red",    docsUrl: "https://merchant.pathao.com/courier/developer-api",
    fields: [
      ["client_id", "Client ID"],
      ["client_secret", "Client Secret", true],
      ["username", "Merchant Email"],
      ["password", "Merchant Password", true],
      ["store_id", "Store ID", false, "1234", "Get from Pathao merchant panel"],
      ["base_url", "Base URL (optional)", false, "https://api-hermes.pathao.com", "Leave default unless using sandbox"],
    ],
  },
  { id: "steadfast", name: "SteadFast Courier", tagline: "BD courier with COD support",         color: "green",  docsUrl: "https://steadfast.com.bd/user/api",
    fields: [["api_key", "API Key", true], ["secret_key", "Secret Key", true]],
  },
  { id: "redx",      name: "RedX",              tagline: "Tech-driven BD logistics",            color: "rose",
    fields: [["access_token", "Access Token", true, "rdx_..."]],
  },
  { id: "paperfly",  name: "Paperfly",          tagline: "Pan-Bangladesh distribution",         color: "sky",
    fields: [["api_key", "API Key", true], ["partner_id", "Partner ID"]],
  },
  { id: "ecourier",  name: "eCourier",          tagline: "Bangladesh nationwide delivery",      color: "teal",
    fields: [["user_id", "User ID"], ["user_secret", "User Secret", true], ["api_key", "API Key", true]],
  },
  { id: "sundarban", name: "Sundarban Courier", tagline: "Long-standing BD logistics provider", color: "amber",
    fields: [["api_key", "API Key", true]],
  },

  // ── India ──
  { id: "delhivery", name: "Delhivery",  tagline: "India's largest supply chain network",        color: "red",
    fields: [["api_token", "API Token", true], ["client_name", "Client Name"]],
  },
  { id: "bluedart",  name: "Blue Dart",  tagline: "Premium courier for India & SAARC",           color: "blue",
    fields: [["api_key", "API Key", true], ["customer_code", "Customer Code"], ["license_key", "License Key", true]],
  },
  { id: "dtdc",      name: "DTDC",       tagline: "Pan-India express services",                  color: "orange",
    fields: [["api_key", "API Key", true], ["customer_code", "Customer Code"]],
  },
  { id: "ekart",     name: "Ekart Logistics", tagline: "Flipkart's logistics arm",               color: "yellow",
    fields: [["api_key", "API Key", true]],
  },
  { id: "xpressbees", name: "Xpressbees", tagline: "Fast-growing Indian logistics",              color: "violet",
    fields: [["api_key", "API Key", true]],
  },

  // ── Pakistan ──
  { id: "tcs",       name: "TCS Courier", tagline: "Pakistan's premier courier",                 color: "red",
    fields: [["username", "Username"], ["password", "Password", true]],
  },
  { id: "leopards",  name: "Leopards Courier", tagline: "Pakistan nationwide delivery",          color: "amber",
    fields: [["api_key", "API Key", true], ["api_password", "API Password", true]],
  },
  { id: "mnp",       name: "M&P Express", tagline: "Pakistan logistics & cargo",                 color: "blue",
    fields: [["api_key", "API Key", true]],
  },

  // ── Southeast Asia ──
  { id: "ninjavan",  name: "Ninja Van",   tagline: "Tech-enabled SEA logistics",                 color: "rose",
    fields: [["client_id", "Client ID"], ["client_secret", "Client Secret", true], ["country", "Country Code", false, "SG", "SG, MY, ID, PH, TH, VN, MM"]],
  },
  { id: "jtexpress", name: "J&T Express", tagline: "Asia-wide express delivery",                 color: "red",
    fields: [["api_key", "API Key", true], ["api_secret", "API Secret", true]],
  },
  { id: "lalamove",  name: "Lalamove",    tagline: "On-demand same-day delivery",                color: "orange",
    fields: [["api_key", "API Key", true], ["api_secret", "API Secret", true], ["market", "Market", false, "HK_HKG", "e.g. HK_HKG, SG_SIN, MY_KUL"]],
  },
  { id: "lbc",       name: "LBC Express", tagline: "Philippines #1 courier",                     color: "red",
    fields: [["api_key", "API Key", true]],
  },
  { id: "kerry",     name: "Kerry Express", tagline: "Thailand & SEA delivery network",          color: "amber",
    fields: [["api_key", "API Key", true]],
  },
  { id: "poslaju",   name: "Pos Laju",    tagline: "Malaysia's national courier",                color: "yellow",
    fields: [["api_key", "API Key", true]],
  },

  // ── East Asia ──
  { id: "sfexpress", name: "SF Express",  tagline: "China's premium express",                    color: "slate",
    fields: [["api_key", "API Key", true], ["partner_id", "Partner ID"], ["checkword", "Checkword", true]],
  },
  { id: "cainiao",   name: "Cainiao",     tagline: "Alibaba's logistics network",                color: "orange",
    fields: [["app_key", "App Key"], ["app_secret", "App Secret", true]],
  },
  { id: "zto",       name: "ZTO Express", tagline: "Major Chinese courier",                      color: "blue",
    fields: [["api_key", "API Key", true]],
  },
  { id: "yto",       name: "YTO Express", tagline: "China nationwide delivery",                  color: "red",
    fields: [["api_key", "API Key", true]],
  },
  { id: "yamato",    name: "Yamato Transport", tagline: "Japan's largest courier (Kuroneko)",    color: "yellow",
    fields: [["api_key", "API Key", true]],
  },
  { id: "cjlogistics", name: "CJ Logistics", tagline: "South Korea's leading logistics",         color: "rose",
    fields: [["api_key", "API Key", true]],
  },

  // ── Global Majors ──
  { id: "dhl",       name: "DHL Express", tagline: "Global express shipping",                    color: "yellow", iconType: "plane",
    fields: [["api_key", "API Key", true], ["account_number", "Account Number"]],
  },
  { id: "fedex",     name: "FedEx",       tagline: "Worldwide overnight & express",              color: "violet", iconType: "plane",
    fields: [["api_key", "API Key", true], ["api_secret", "API Secret", true], ["account_number", "Account Number"]],
  },
  { id: "ups",       name: "UPS",         tagline: "Global package delivery",                    color: "amber",  iconType: "truck",
    fields: [["access_key", "Access Key", true], ["username", "Username"], ["password", "Password", true]],
  },
  { id: "usps",      name: "USPS",        tagline: "United States Postal Service",               color: "blue",
    fields: [["userid", "User ID"], ["password", "Password", true]],
  },
  { id: "tnt",       name: "TNT (FedEx)", tagline: "European express network",                   color: "orange", iconType: "plane",
    fields: [["api_key", "API Key", true]],
  },

  // ── Europe ──
  { id: "gls",       name: "GLS",         tagline: "European parcel logistics",                  color: "yellow",
    fields: [["api_key", "API Key", true], ["contact_id", "Contact ID"]],
  },
  { id: "postnl",    name: "PostNL",      tagline: "Netherlands postal & parcels",               color: "orange",
    fields: [["api_key", "API Key", true], ["customer_code", "Customer Code"], ["customer_number", "Customer Number"]],
  },
  { id: "dpd",       name: "DPD",         tagline: "European road network parcels",              color: "red",    iconType: "truck",
    fields: [["api_key", "API Key", true]],
  },
  { id: "hermes",    name: "Evri (Hermes)", tagline: "UK consumer parcels",                      color: "violet",
    fields: [["api_key", "API Key", true]],
  },
  { id: "royalmail", name: "Royal Mail",  tagline: "UK national postal service",                 color: "red",
    fields: [["api_key", "API Key", true], ["client_id", "Client ID"]],
  },
  { id: "colissimo", name: "Colissimo",   tagline: "La Poste France parcels",                    color: "blue",
    fields: [["api_key", "API Key", true], ["contract_number", "Contract Number"]],
  },
  { id: "bpost",     name: "Bpost",       tagline: "Belgium's national post",                    color: "amber",
    fields: [["api_key", "API Key", true]],
  },
  { id: "deutschepost", name: "Deutsche Post / DHL Paket", tagline: "Germany's national post",   color: "yellow",
    fields: [["api_key", "API Key", true]],
  },
  { id: "correos",   name: "Correos",     tagline: "Spain's postal service",                     color: "yellow",
    fields: [["api_key", "API Key", true]],
  },
  { id: "posteitaliane", name: "Poste Italiane", tagline: "Italy's national post",               color: "blue",
    fields: [["api_key", "API Key", true]],
  },

  // ── Americas ──
  { id: "canadapost", name: "Canada Post", tagline: "Canada's national postal service",          color: "red",
    fields: [["api_key", "API Key", true], ["customer_number", "Customer Number"]],
  },
  { id: "correios",  name: "Correios",     tagline: "Brazil's national postal service",          color: "yellow",
    fields: [["api_key", "API Key", true], ["contract_code", "Contract Code"]],
  },
  { id: "estafeta",  name: "Estafeta",     tagline: "Mexico's express courier",                  color: "rose",
    fields: [["api_key", "API Key", true], ["login", "Login"]],
  },
  { id: "ontrac",    name: "OnTrac",       tagline: "US West Coast express delivery",            color: "amber",
    fields: [["api_key", "API Key", true]],
  },
  { id: "dhlecommerce", name: "DHL eCommerce", tagline: "Global e-commerce logistics",           color: "yellow", iconType: "globe",
    fields: [["api_key", "API Key", true]],
  },

  // ── Oceania ──
  { id: "auspost",   name: "Australia Post", tagline: "Australia's postal & parcels",            color: "red",
    fields: [["api_key", "API Key", true], ["account_number", "Account Number"]],
  },
  { id: "startrack", name: "StarTrack",    tagline: "Australia premium express",                 color: "blue",
    fields: [["api_key", "API Key", true], ["account_number", "Account Number"]],
  },
  { id: "aramex_au", name: "Aramex Australia", tagline: "Australia road express",                color: "green",
    fields: [["api_key", "API Key", true]],
  },
  { id: "nzpost",    name: "NZ Post",      tagline: "New Zealand postal service",                color: "indigo",
    fields: [["api_key", "API Key", true]],
  },

  // ── Middle East & Africa ──
  { id: "aramex",    name: "Aramex",       tagline: "Middle East & global logistics",            color: "red",    iconType: "globe",
    fields: [["account_number", "Account Number"], ["password", "Password", true], ["account_pin", "Account PIN", true], ["account_entity", "Account Entity"], ["account_country_code", "Account Country Code"]],
  },
  { id: "naqel",     name: "Naqel Express", tagline: "Saudi Arabia & Gulf delivery",             color: "emerald",
    fields: [["api_key", "API Key", true]],
  },
  { id: "smsa",      name: "SMSA Express", tagline: "Saudi Arabia express courier",              color: "green",
    fields: [["api_key", "API Key", true]],
  },
  { id: "dpd_africa", name: "DPD Africa",   tagline: "African road network parcels",             color: "red",
    fields: [["api_key", "API Key", true]],
  },
  { id: "postnet",   name: "PostNet",      tagline: "Africa & USA pack-and-ship",                color: "amber",
    fields: [["api_key", "API Key", true]],
  },

  // ── CIS ──
  { id: "cdek",      name: "CDEK",         tagline: "Russia & CIS express delivery",             color: "green",
    fields: [["account", "Account"], ["password", "Password", true]],
  },
  { id: "russianpost", name: "Russian Post", tagline: "Russia's national postal service",        color: "blue",
    fields: [["api_token", "API Token", true]],
  },
];

function getCourierIcon(t?: string): React.ReactNode {
  const cls = "h-7 w-7";
  switch (t) {
    case "plane": return <Plane className={cls} />;
    case "ship":  return <Ship className={cls} />;
    case "globe": return <Globe className={cls} />;
    case "map":   return <MapPin className={cls} />;
    default:      return <Truck className={cls} />;
  }
}

function buildCouriers(): PlatformConfig[] {
  return COURIER_DEFS.map(def => {
    const c = COURIER_COLOR_CLASSES[def.color];
    return {
      id: def.id,
      category: "Couriers" as PlatformCategory,
      integrationType: "courier" as IntegrationType,
      name: def.name,
      tagline: def.tagline,
      icon: getCourierIcon(def.iconType),
      color: c.bg,
      textColor: c.text,
      borderColor: c.border,
      docsUrl: def.docsUrl ?? "#",
      credentialFields: def.fields.map(([key, label, secret, placeholder, hint]) => ({
        key, label,
        placeholder: placeholder ?? "",
        type: (secret ? "password" : "text") as "text" | "password",
        ...(hint ? { hint } : {}),
      })),
      setupSteps: [
        { title: `Sign in to ${def.name}`, description: `Log in to your ${def.name} merchant or developer account.` },
        { title: "Get API credentials", description: def.setupNotes ?? `Find your API keys/credentials in the ${def.name} dashboard or developer settings.` },
        { title: "Paste & save", description: "Enter the credentials below and click Save. We'll verify the connection." },
        { title: "Start shipping", description: "Once connected, the AI can automatically create shipments and provide tracking to customers." },
      ],
    };
  });
}

// Append couriers to PLATFORMS now that COURIER_DEFS/COURIER_COLOR_CLASSES are initialized.
// (Mutating a const array is fine — only the binding is const, not the contents.)
PLATFORMS.push(...buildCouriers());

/* ──────────────────────────────────────────────────────────────────
   Category metadata
────────────────────────────────────────────────────────────────── */
const CATEGORY_META: Record<PlatformCategory, { icon: React.ReactNode; description: string; color: string }> = {
  "Messaging":      { icon: <MessageCircle className="h-4 w-4" />, description: "AI handles customer chats directly inside each platform", color: "text-blue-600 dark:text-blue-400" },
  "E-Commerce":     { icon: <ShoppingBag className="h-4 w-4" />,   description: "Sync products, orders and customer data from your store", color: "text-green-600 dark:text-green-400" },
  "CRM & Helpdesk": { icon: <Headphones className="h-4 w-4" />,    description: "Connect your CRM to unify customer support and sales",   color: "text-orange-600 dark:text-orange-400" },
  "Payments":       { icon: <CreditCard className="h-4 w-4" />,     description: "Receive payment events, refunds and dispute alerts",     color: "text-violet-600 dark:text-violet-400" },
  "Couriers":       { icon: <Truck className="h-4 w-4" />,          description: "Auto-ship orders & give customers real-time tracking",   color: "text-rose-600 dark:text-rose-400" },
};

const ALL_CATEGORIES: PlatformCategory[] = ["Messaging", "E-Commerce", "CRM & Helpdesk", "Payments", "Couriers"];

/* ──────────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────────── */
const SUPABASE_FUNCTIONS_URL = (() => {
  const url = (import.meta as any).env?.VITE_SUPABASE_URL ?? "";
  return url.replace(/\/$/, "");
})();

function webhookUrl(platform: string, businessId: string) {
  return `${SUPABASE_FUNCTIONS_URL}/functions/v1/platform-webhook?platform=${platform}&business_id=${businessId}`;
}

function relativeTime(iso: string | null) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)    return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/* ──────────────────────────────────────────────────────────────────
   Sub-components
────────────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: PlatformStatus }) {
  const map: Record<PlatformStatus, { label: string; className: string; icon: React.ReactNode }> = {
    connected:    { label: "Connected",    className: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30",       icon: <Wifi className="h-3 w-3" /> },
    pending:      { label: "Pending",      className: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",   icon: <RefreshCw className="h-3 w-3 animate-spin" /> },
    error:        { label: "Error",        className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",               icon: <AlertCircle className="h-3 w-3" /> },
    disconnected: { label: "Disconnected", className: "bg-muted text-muted-foreground border-border",                                 icon: <WifiOff className="h-3 w-3" /> },
  };
  const { label, className, icon } = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1 border px-2 py-0.5 rounded-full text-xs font-medium", className)}>
      {icon}{label}
    </span>
  );
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="outline" size="sm" onClick={copy} className="gap-1.5 flex-shrink-0">
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : label}
    </Button>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Setup Sheet
────────────────────────────────────────────────────────────────── */
function SetupSheet({
  open,
  onClose,
  platform,
  businessId,
  existing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  platform: PlatformConfig;
  businessId: string;
  existing: PlatformIntegration | null;
  onSaved: (row: PlatformIntegration, platformConfig: PlatformConfig) => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    platform.credentialFields.forEach((f) => { init[f.key] = existing?.credentials?.[f.key] ?? ""; });
    return init;
  });

  // Reset when platform changes
  useEffect(() => {
    const init: Record<string, string> = {};
    platform.credentialFields.forEach((f) => { init[f.key] = existing?.credentials?.[f.key] ?? ""; });
    setFields(init);
  }, [platform.id, existing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-generate a stable UUID so the verify token is visible BEFORE the user
  // saves credentials for the first time (chicken-and-egg fix).
  const [localVerifyToken] = useState(() => existing?.webhook_verify_token ?? crypto.randomUUID());
  const wUrl = webhookUrl(platform.id, businessId);
  const verifyToken = existing?.webhook_verify_token ?? localVerifyToken;

  const handleSave = async () => {
    const empty = platform.credentialFields.find((f) => !fields[f.key]?.trim());
    if (empty) {
      toast({ title: "Missing field", description: `${empty.label} is required.`, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        business_id: businessId,
        platform: platform.id,
        credentials: fields,
        status: "pending" as PlatformStatus,
        webhook_verify_token: localVerifyToken, // ensure DB matches what user already configured
      };

      let result: PlatformIntegration;
      if (existing) {
        const { data, error } = await supabase
          .from("platform_integrations" as any)
          .update({ credentials: fields as any, status: "pending", error_message: null })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        result = data as unknown as PlatformIntegration;
      } else {
        const { data, error } = await supabase
          .from("platform_integrations" as any)
          .insert(payload as any)
          .select()
          .single();
        if (error) throw error;
        result = data as unknown as PlatformIntegration;
      }

      // For Telegram: auto-register webhook via Bot API
      if (platform.id === "telegram" && fields.bot_token) {
        await fetch(`https://api.telegram.org/bot${fields.bot_token}/setWebhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: wUrl }),
        }).then(async (r) => {
          const d = await r.json();
          if (d.ok) {
            await supabase
              .from("platform_integrations" as any)
              .update({ webhook_verified: true, status: "connected", connected_at: new Date().toISOString() } as any)
              .eq("id", result.id);
            result = { ...result, status: "connected", webhook_verified: true };
          }
        }).catch(() => {});
      }

      toast({
        title: "Credentials saved",
        description: platform.id === "telegram"
          ? "Telegram webhook registered automatically! Your bot is live."
          : platform.integrationType === "messaging"
          ? "Now configure the webhook URL in your platform's developer console."
          : "Credentials saved — starting sync…",
      });
      onSaved(result, platform);
      if (platform.id === "telegram") onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const isMessaging = platform.integrationType === "messaging";
  const showWebhook = isMessaging && platform.id !== "telegram";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto" side="right">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-3">
            <div className={cn("p-3 rounded-xl", platform.color, platform.textColor)}>
              {platform.icon}
            </div>
            <div>
              <SheetTitle className="text-xl">{platform.name}</SheetTitle>
              <SheetDescription>{platform.tagline}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-8">
          {/* ── Step guide ── */}
          <div>
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Setup Guide
            </h3>
            <ol className="space-y-3">
              {platform.setupSteps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <a
              href={platform.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-3"
            >
              <ExternalLink className="h-3 w-3" /> View official docs
            </a>
          </div>

          {/* ── What syncs (e-commerce / crm / payment) ── */}
          {!isMessaging && platform.syncs && (
            <div className="space-y-3 p-4 rounded-xl border bg-muted/40">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What Syncs</p>
              <ul className="space-y-1.5">
                {platform.syncs.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground pt-1">
                OctaDezx will sync this data automatically so your AI assistant has full context when customers ask about products, orders, or account status.
              </p>
            </div>
          )}

          {/* ── Webhook URL + Verify Token (messaging, non-Telegram) ── */}
          {showWebhook && (
            <div className="space-y-4 p-4 rounded-xl border bg-muted/40">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Webhook Details</p>
              <div>
                <Label className="text-xs mb-1.5 block">Webhook URL — paste this in your platform's developer console</Label>
                <div className="w-full overflow-x-auto rounded-md border bg-background px-3 py-2 mb-2">
                  <code className="text-xs text-primary whitespace-nowrap">
                    {wUrl}
                  </code>
                </div>
                <CopyButton value={wUrl} label="Copy URL" />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Verify Token — enter this as the webhook verify token</Label>
                <div className="w-full overflow-x-auto rounded-md border bg-background px-3 py-2 mb-2">
                  <code className="text-xs font-mono whitespace-nowrap">
                    {verifyToken}
                  </code>
                </div>
                <CopyButton value={verifyToken} label="Copy Token" />
              </div>
            </div>
          )}

          {/* ── Payments webhook URL ── */}
          {platform.integrationType === "payment" && (
            <div className="p-4 rounded-xl border bg-muted/40 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Webhook URL</p>
              <Label className="text-xs mb-1.5 block">Paste this URL in your payment provider's webhook settings</Label>
              <div className="w-full overflow-x-auto rounded-md border bg-background px-3 py-2 mb-2">
                <code className="text-xs text-primary whitespace-nowrap">{wUrl}</code>
              </div>
              <CopyButton value={wUrl} label="Copy URL" />
            </div>
          )}

          {/* ── Credential fields ── */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {platform.id === "telegram" ? "Bot Credentials" : "API Credentials"}
            </p>
            {platform.credentialFields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key}>{f.label}</Label>
                <Input
                  id={f.key}
                  type={f.type ?? "text"}
                  placeholder={f.placeholder}
                  value={fields[f.key] ?? ""}
                  onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  className="font-mono text-sm"
                />
                {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
              </div>
            ))}
          </div>

          {/* ── Save button ── */}
          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
            {saving ? "Saving…" : existing ? "Update Credentials" : "Save & Connect"}
          </Button>

          {/* ── Existing status ── */}
          {existing && (
            <div className="p-3 rounded-lg border bg-muted/30 space-y-1 text-xs text-muted-foreground">
              <p className="flex justify-between"><span>Status</span><StatusBadge status={existing.status} /></p>
              {isMessaging && (
                <p className="flex justify-between"><span>Webhook verified</span><span>{existing.webhook_verified ? "✓ Yes" : "✗ No"}</span></p>
              )}
              {isMessaging && (
                <p className="flex justify-between"><span>Messages handled</span><span>{existing.message_count.toLocaleString()}</span></p>
              )}
              <p className="flex justify-between"><span>Last activity</span><span>{relativeTime(existing.last_message_at)}</span></p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Main component
────────────────────────────────────────────────────────────────── */
interface Props { businessId: string; }

export default function PlatformIntegrations({ businessId }: Props) {
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<PlatformIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PlatformConfig | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<PlatformCategory | "All">("All");
  const [isSyncing, setIsSyncing] = useState<Record<string, boolean>>({});

  /* ── Load integrations ── */
  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("platform_integrations" as any)
      .select("*")
      .eq("business_id", businessId)
      .order("created_at");
    if (!error) setIntegrations((data ?? []) as unknown as PlatformIntegration[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [businessId]); // eslint-disable-line react-hooks/exhaustive-deps

  const getIntegration = (platformId: string) =>
    integrations.find((i) => i.platform === platformId) ?? null;

  const handleOpen = (pc: PlatformConfig) => {
    setSelected(pc);
    setSheetOpen(true);
  };

  const handleSaved = (row: PlatformIntegration, platformConfig: PlatformConfig) => {
    setIntegrations((prev) => {
      const idx = prev.findIndex((i) => i.platform === row.platform);
      return idx >= 0 ? prev.map((i, n) => (n === idx ? row : i)) : [...prev, row];
    });
    // Auto-sync e-commerce/CRM/payment after saving (couriers + messaging don't sync products)
    const autoSyncTypes: IntegrationType[] = ["ecommerce", "crm", "payment"];
    if (autoSyncTypes.includes(platformConfig.integrationType)) {
      handleSync(row.platform, true).then(() => {
        toast({
          title: "Connected & synced",
          description: `${platformConfig.name} is connected. Data sync complete.`,
        });
      });
    } else if (platformConfig.integrationType === "courier") {
      toast({
        title: "Courier connected",
        description: `${platformConfig.name} is ready. Orders will auto-create shipments.`,
      });
    }
  };

  const handleDisconnect = async (integration: PlatformIntegration) => {
    const { error } = await supabase
      .from("platform_integrations" as any)
      .update({ status: "disconnected", webhook_verified: false, connected_at: null, credentials: {} } as any)
      .eq("id", integration.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Disconnected", description: `${integration.platform} has been disconnected.` });
      setIntegrations((prev) =>
        prev.map((i) => i.id === integration.id ? { ...i, status: "disconnected", webhook_verified: false } : i)
      );
    }
  };

  /* ── Sync e-commerce / CRM / payment ── */
  const handleSync = async (platformId: string, silent = false) => {
    setIsSyncing((prev) => ({ ...prev, [platformId]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const FUNCTIONS_URL = (import.meta as any).env?.VITE_SUPABASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${FUNCTIONS_URL}/functions/v1/sync-ecommerce`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ businessId, platform: platformId }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Sync failed");

      // Refresh integration row to pick up new status
      await load();

      if (!silent) {
        const { productsCount = 0, ordersCount = 0 } = result;
        const parts = [];
        if (productsCount > 0) parts.push(`${productsCount} products`);
        if (ordersCount > 0) parts.push(`${ordersCount} orders`);
        toast({
          title: "Sync complete",
          description: parts.length > 0
            ? `Synced ${parts.join(" and ")} from ${platformId}.`
            : `${platformId} connected successfully.`,
        });
      }
    } catch (e: any) {
      if (!silent) {
        toast({ title: "Sync failed", description: e.message, variant: "destructive" });
      }
    } finally {
      setIsSyncing((prev) => ({ ...prev, [platformId]: false }));
    }
  };

  /* ── Stats ── */
  const connected     = integrations.filter((i) => i.status === "connected").length;
  const totalMessages = integrations.reduce((s, i) => s + (i.message_count ?? 0), 0);

  /* ── Filtered platforms ── */
  const visiblePlatforms = activeCategory === "All"
    ? PLATFORMS
    : PLATFORMS.filter((p) => p.category === activeCategory);

  /* ── Categories to render (grouped) ── */
  const categoriesToRender = activeCategory === "All" ? ALL_CATEGORIES : [activeCategory];

  return (
    <div className="space-y-6">

      {/* ── Header + summary ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Plug className="h-5 w-5 text-primary" /> Platform Integrations
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect messaging apps, e-commerce stores, CRM tools and payment providers — all in one place.
          </p>
        </div>
        {!loading && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground shrink-0">
            <span className="font-semibold text-foreground">{connected}</span> connected
            <span className="text-border">·</span>
            <span className="font-semibold text-foreground">{totalMessages.toLocaleString()}</span> messages
            <span className="text-border">·</span>
            <span className="font-semibold text-foreground">{PLATFORMS.length}</span> available
          </div>
        )}
      </div>

      {/* ── How it works ── */}
      <div className="rounded-xl border bg-primary/5 p-4 flex gap-4 items-start">
        <Bot className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <p className="font-medium">How it works</p>
          <p className="text-muted-foreground leading-relaxed">
            Connect a <strong>messaging platform</strong> and OctaDezx AI will reply to customers directly inside WhatsApp, Telegram, Instagram, and more — no external link needed.
            Connect an <strong>e-commerce store</strong> to give your AI real-time knowledge of your products, orders, and inventory so it can answer any customer question accurately.
          </p>
        </div>
      </div>

      {/* ── Category filter tabs ── */}
      <div className="flex flex-wrap gap-2">
        {(["All", ...ALL_CATEGORIES] as const).map((cat) => {
          const count = cat === "All"
            ? integrations.filter(i => i.status === "connected").length
            : integrations.filter(i => {
                const p = PLATFORMS.find(p => p.id === i.platform);
                return p?.category === cat && i.status === "connected";
              }).length;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                activeCategory === cat
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
              )}
            >
              {cat !== "All" && CATEGORY_META[cat].icon}
              {cat}
              {count > 0 && (
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  activeCategory === cat ? "bg-primary-foreground/20" : "bg-green-500/15 text-green-600 dark:text-green-400"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Platform grid (grouped by category) ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="border rounded-xl p-5 space-y-3">
              <div className="flex justify-between">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {categoriesToRender.map((cat) => {
            const catPlatforms = visiblePlatforms.filter(p => p.category === cat);
            if (catPlatforms.length === 0) return null;
            const meta = CATEGORY_META[cat];

            return (
              <div key={cat} className="space-y-3">
                {/* Category header */}
                {activeCategory === "All" && (
                  <div className="flex items-center gap-2">
                    <span className={cn("flex items-center gap-1.5 text-sm font-semibold", meta.color)}>
                      {meta.icon} {cat}
                    </span>
                    <span className="text-xs text-muted-foreground">— {meta.description}</span>
                    <div className="flex-1 h-px bg-border ml-2" />
                  </div>
                )}

                {/* Platform cards grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {catPlatforms.map((pc) => {
                    const integration = getIntegration(pc.id);
                    const status: PlatformStatus = integration?.status ?? "disconnected";
                    const isConnected = status === "connected";

                    return (
                      <div
                        key={pc.id}
                        className={cn(
                          "relative border rounded-xl p-5 flex flex-col gap-4 transition-shadow hover:shadow-md cursor-pointer",
                          isConnected && `${pc.borderColor} border-2`,
                        )}
                      >
                        {/* Top row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className={cn("p-2.5 rounded-xl", pc.color, pc.textColor)}>
                            {pc.icon}
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <StatusBadge status={status} />
                          </div>
                        </div>

                        {/* Name & tagline */}
                        <div>
                          <p className="font-semibold text-sm">{pc.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{pc.tagline}</p>
                        </div>

                        {/* What syncs preview (e-commerce/crm/payment) */}
                        {!isConnected && pc.syncs && !pc.comingSoon && (
                          <div className="flex flex-wrap gap-1">
                            {pc.syncs.slice(0, 2).map((s) => (
                              <span key={s} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                {s}
                              </span>
                            ))}
                            {pc.syncs.length > 2 && (
                              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                +{pc.syncs.length - 2} more
                              </span>
                            )}
                          </div>
                        )}

                        {/* Stats (connected only) */}
                        {isConnected && integration && (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {pc.integrationType === "messaging" && (
                              <div className="bg-muted/50 rounded-lg p-2">
                                <p className="text-muted-foreground">Messages</p>
                                <p className="font-bold text-base">{integration.message_count.toLocaleString()}</p>
                              </div>
                            )}
                            <div className={cn("bg-muted/50 rounded-lg p-2", pc.integrationType !== "messaging" && "col-span-2")}>
                              <p className="text-muted-foreground">Last active</p>
                              <p className="font-semibold">{relativeTime(integration.last_message_at)}</p>
                            </div>
                            {integration.platform_account_name && (
                              <div className="col-span-2 bg-muted/50 rounded-lg p-2">
                                <p className="text-muted-foreground">Account</p>
                                <p className="font-medium truncate">{integration.platform_account_name}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Error message */}
                        {status === "error" && integration?.error_message && (
                          <p className="text-xs text-destructive bg-destructive/10 rounded-lg p-2">
                            {integration.error_message}
                          </p>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 mt-auto">
                          <Button
                            size="sm"
                            variant={isConnected ? "outline" : "default"}
                            className="flex-1 gap-1.5"
                            onClick={() => handleOpen(pc)}
                          >
                            {isConnected
                              ? <><Send className="h-3.5 w-3.5" /> Manage</>
                              : <><PlugZap className="h-3.5 w-3.5" /> Connect</>
                            }
                          </Button>

                          {/* Sync Now button — only for e-commerce/CRM/payments (couriers + messaging don't sync data) */}
                          {isConnected && (pc.integrationType === "ecommerce" || pc.integrationType === "crm" || pc.integrationType === "payment") && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 px-2.5"
                              disabled={isSyncing[pc.id]}
                              onClick={() => handleSync(pc.id)}
                              title="Sync Now"
                            >
                              <RefreshCw className={cn("h-3.5 w-3.5", isSyncing[pc.id] && "animate-spin")} />
                              {isSyncing[pc.id] ? "Syncing…" : "Sync"}
                            </Button>
                          )}

                          {isConnected && integration && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="px-2 text-destructive hover:text-destructive hover:bg-destructive/10">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Disconnect {pc.name}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Your credentials will be removed and OctaDezx will stop responding to messages
                                    on this platform. You can reconnect at any time.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                    onClick={() => handleDisconnect(integration)}
                                  >
                                    Disconnect
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Setup sheet ── */}
      {selected && (
        <SetupSheet
          open={sheetOpen}
          onClose={() => { setSheetOpen(false); setSelected(null); }}
          platform={selected}
          businessId={businessId}
          existing={getIntegration(selected.id)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
