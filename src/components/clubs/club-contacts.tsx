import { Globe, Mail, MapPin, Phone } from "lucide-react";
import { MetaItem } from "~/components/ds/list";

const external = (value: string, base: string) =>
  value.startsWith("http") ? value : `${base}${value}`;

const linkClass =
  "text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline";

/** A club's place and contact details, then its website and socials. */
export function ClubContacts({
  club,
  socialLinks,
}: {
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
      label: "X",
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
  return (
    <>
      {club.location && <MetaItem icon={MapPin}>{club.location}</MetaItem>}
      {club.contact_email && (
        <MetaItem icon={Mail}>{club.contact_email}</MetaItem>
      )}
      {club.contact_phone && (
        <MetaItem icon={Phone}>{club.contact_phone}</MetaItem>
      )}
      {links.map((l) => (
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
