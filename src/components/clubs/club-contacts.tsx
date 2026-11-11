import { AtSign, Globe, Mail, MapPin, Phone, type LucideIcon } from "lucide-react";
import { MetaItem } from "~/components/ds/list";
import { buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";

const external = (value: string, base: string) =>
  value.startsWith("http") ? value : `${base}${value}`;

const linkClass =
  "text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline";

/**
 * A club's contact details as rows of the phone's ⋯ sheet (T10): one 44px
 * row each, an icon and what it does ("Email", "Call", "Instagram"), where
 * they were 16px text links and "X" was 8px wide.
 */
export function ClubContactRows({
  club,
  socialLinks,
}: {
  club: {
    contact_email?: string | null;
    contact_phone?: string | null;
    website_url?: string | null;
  };
  socialLinks: Record<string, string>;
}) {
  const rows: { label: string; href: string; icon: LucideIcon; external?: boolean }[] = [];
  if (club.contact_email)
    rows.push({ label: "Email", href: `mailto:${club.contact_email}`, icon: Mail });
  if (club.contact_phone)
    rows.push({ label: "Call", href: `tel:${club.contact_phone}`, icon: Phone });
  if (club.website_url)
    rows.push({ label: "Website", href: external(club.website_url, "https://"), icon: Globe, external: true });
  if (socialLinks.twitter)
    rows.push({ label: "X (Twitter)", href: external(socialLinks.twitter, "https://x.com/"), icon: AtSign, external: true });
  if (socialLinks.instagram)
    rows.push({ label: "Instagram", href: external(socialLinks.instagram, "https://instagram.com/"), icon: AtSign, external: true });
  if (socialLinks.youtube)
    rows.push({ label: "YouTube", href: external(socialLinks.youtube, "https://youtube.com/"), icon: AtSign, external: true });
  return (
    <>
      {rows.map(({ label, href, icon: Icon, external: away }) => (
        <a
          key={label}
          href={href}
          className={cn(buttonVariants({ variant: "outline" }), "min-h-11 justify-start gap-2")}
          {...(away ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {label}
        </a>
      ))}
    </>
  );
}

/**
 * A club's place and contact details, then its website and socials. `part`
 * splits them for phones: the place in the header, the rest in the ⋯ sheet
 * (`ClubContactRows`).
 */
export function ClubContacts({
  club,
  socialLinks,
  part,
}: {
  part?: "place" | "contact";
  club: {
    location?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    website_url?: string | null;
  };
  socialLinks: Record<string, string>;
}) {
  const links = [
    club.website_url && {
      label: "Website",
      href: external(club.website_url, "https://"),
      icon: true,
    },
    socialLinks.twitter && {
      // "X" alone did not read as a link (T10).
      label: "X (Twitter)",
      href: external(socialLinks.twitter, "https://x.com/"),
    },
    socialLinks.instagram && {
      label: "Instagram",
      href: external(socialLinks.instagram, "https://instagram.com/"),
    },
    socialLinks.youtube && {
      label: "YouTube",
      href: external(socialLinks.youtube, "https://youtube.com/"),
    },
  ].filter((l): l is { label: string; href: string; icon?: boolean } =>
    Boolean(l),
  );
  const contact = part !== "place";
  return (
    <>
      {part !== "contact" && club.location && (
        <MetaItem icon={MapPin}>{club.location}</MetaItem>
      )}
      {contact && club.contact_email && (
        <MetaItem icon={Mail}>{club.contact_email}</MetaItem>
      )}
      {contact && club.contact_phone && (
        <MetaItem icon={Phone}>{club.contact_phone}</MetaItem>
      )}
      {(contact ? links : []).map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className={
            l.icon ? `inline-flex items-center gap-1.5 ${linkClass}` : linkClass
          }
        >
          {l.icon && <Globe className="h-3.5 w-3.5" aria-hidden="true" />}
          {l.label}
        </a>
      ))}
    </>
  );
}
