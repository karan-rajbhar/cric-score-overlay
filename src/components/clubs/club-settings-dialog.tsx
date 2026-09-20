"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Settings, Loader2, Globe, Mail, Phone } from "lucide-react";
import { updateClub, updateClubSocialLinks } from "~/app/clubs/actions";
import { ClubLogo } from "~/components/clubs/club-logo";
import { ClubMediaDialog } from "~/components/clubs/club-media-dialog";
import { toast } from "sonner";

interface ClubData {
  id: string;
  name: string;
  short_name?: string | null;
  location?: string | null;
  description?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  website_url?: string | null;
  club_type?: string | null;
  founded_year?: number | null;
  is_public?: boolean | null;
  social_links?: Record<string, string> | null;
  logo_url?: string | null;
  banner_url?: string | null;
}

interface ClubSettingsDialogProps {
  club: ClubData;
}

export function ClubSettingsDialog({ club }: ClubSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(club.name);
  const [shortName, setShortName] = useState(club.short_name ?? "");
  const [location, setLocation] = useState(club.location ?? "");
  const [description, setDescription] = useState(club.description ?? "");
  const [contactEmail, setContactEmail] = useState(club.contact_email ?? "");
  const [contactPhone, setContactPhone] = useState(club.contact_phone ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(club.website_url ?? "");
  const [clubType, setClubType] = useState(club.club_type ?? "community");
  const [foundedYear, setFoundedYear] = useState(
    club.founded_year ? String(club.founded_year) : ""
  );
  const [twitter, setTwitter] = useState(club.social_links?.twitter ?? "");
  const [instagram, setInstagram] = useState(club.social_links?.instagram ?? "");
  const [youtube, setYoutube] = useState(club.social_links?.youtube ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Club name is required");
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("name", name.trim());
      fd.set("short_name", shortName.trim());
      fd.set("location", location.trim());
      fd.set("description", description.trim());
      fd.set("contact_email", contactEmail.trim());
      fd.set("contact_phone", contactPhone.trim());
      fd.set("website_url", websiteUrl.trim());
      fd.set("club_type", clubType);
      if (foundedYear) {
        fd.set("founded_year", foundedYear);
      }

      const res = await updateClub(club.id, fd);
      if (res?.error) {
        toast.error(res.error);
        setSaving(false);
        return;
      }

      // Update social links if changed
      const socialPayload: Record<string, string> = {};
      if (twitter.trim()) socialPayload.twitter = twitter.trim();
      if (instagram.trim()) socialPayload.instagram = instagram.trim();
      if (youtube.trim()) socialPayload.youtube = youtube.trim();

      await updateClubSocialLinks(club.id, socialPayload);

      toast.success("Club profile & settings updated!");
      setOpen(false);
    } catch (err) {
      console.error("Error updating club:", err);
      toast.error("Failed to update club settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 min-h-[36px] gap-1.5 text-xs">
          <Settings className="h-3.5 w-3.5" />
          <span>Club Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Club Settings & Profile</DialogTitle>
          <DialogDescription>
            Update your club identity, community contacts, and social media
            links.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ClubLogo
              name={club.name}
              shortName={club.short_name}
              logoUrl={club.logo_url}
              className="h-9 w-9 rounded-lg text-xs"
            />
            <div>
              <p className="text-xs font-semibold">Club Emblem & Banner</p>
              <p className="text-[11px] text-muted-foreground">
                Manage custom crest logo and hero cover
              </p>
            </div>
          </div>
          <ClubMediaDialog
            clubId={club.id}
            clubName={club.name}
            shortName={club.short_name}
            initialLogoUrl={club.logo_url}
            initialBannerUrl={club.banner_url}
            trigger={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 min-h-[32px] text-xs"
              >
                Edit Branding
              </Button>
            }
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-sm">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="club-name">Club Name *</Label>
              <Input
                id="club-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Marylebone Cricket Club"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="club-short-name">Short Name</Label>
              <Input
                id="club-short-name"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="e.g. MCC"
                maxLength={10}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="club-type">Club Type</Label>
              <Select value={clubType} onValueChange={setClubType}>
                <SelectTrigger id="club-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="community">Community / Local</SelectItem>
                  <SelectItem value="corporate">Corporate / League</SelectItem>
                  <SelectItem value="school">School / University</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="club-founded">Founded Year</Label>
              <Input
                id="club-founded"
                type="number"
                value={foundedYear}
                onChange={(e) => setFoundedYear(e.target.value)}
                placeholder="e.g. 1985"
                min={1800}
                max={2050}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="club-location">Home Ground / Location</Label>
            <Input
              id="club-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Lord's Cricket Ground, London"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="club-description">About / Bio</Label>
            <Textarea
              id="club-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="History, facilities, training schedules..."
              rows={3}
            />
          </div>

          {/* Contact Details */}
          <div className="border-t border-border/60 pt-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Contact & Links
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="club-email" className="text-xs">
                  <Mail className="mr-1 inline h-3 w-3" />
                  Contact Email
                </Label>
                <Input
                  id="club-email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="contact@club.com"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="club-phone" className="text-xs">
                  <Phone className="mr-1 inline h-3 w-3" />
                  Phone Number
                </Label>
                <Input
                  id="club-phone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+44 20 7616 8500"
                  className="h-8 text-xs"
                />
              </div>
              <div className="col-span-1 space-y-1 sm:col-span-2">
                <Label htmlFor="club-website" className="text-xs">
                  <Globe className="mr-1 inline h-3 w-3" />
                  Website
                </Label>
                <Input
                  id="club-website"
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://lords.org"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Social Profiles */}
          <div className="border-t border-border/60 pt-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Social Media Handles
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="club-twitter" className="text-[11px]">
                  X / Twitter
                </Label>
                <Input
                  id="club-twitter"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="@clubhandle"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="club-instagram" className="text-[11px]">
                  Instagram
                </Label>
                <Input
                  id="club-instagram"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@clubhandle"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="club-youtube" className="text-[11px]">
                  YouTube
                </Label>
                <Input
                  id="club-youtube"
                  value={youtube}
                  onChange={(e) => setYoutube(e.target.value)}
                  placeholder="channel link"
                  className="h-10 sm:h-8 text-base sm:text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border/60 pt-3 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="h-10 min-h-[40px] sm:h-9 text-sm font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="h-10 min-h-[40px] sm:h-9 text-sm font-semibold"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
