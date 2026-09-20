"use client";

import React, { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { ClubLogo } from "~/components/clubs/club-logo";
import {
  updateClubLogo,
  removeClubLogo,
  updateClubBanner,
  removeClubBanner,
} from "~/app/clubs/actions";
import { toast } from "sonner";
import { Camera, Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react";

interface ClubMediaDialogProps {
  clubId: string;
  clubName: string;
  shortName?: string | null;
  initialLogoUrl?: string | null;
  initialBannerUrl?: string | null;
  trigger?: React.ReactNode;
}

export function ClubMediaDialog({
  clubId,
  clubName,
  shortName,
  initialLogoUrl,
  initialBannerUrl,
  trigger,
}: ClubMediaDialogProps) {
  const [open, setOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl ?? null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(
    initialBannerUrl ?? null,
  );
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const res = await updateClubLogo(clubId, file);
      if (res.error || !res.data) {
        toast.error(res.error ?? "Failed to upload club logo");
      } else {
        setLogoUrl(res.data);
        toast.success("Club logo updated");
      }
    } catch {
      toast.error("An unexpected error occurred while uploading the logo");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = async () => {
    setUploadingLogo(true);
    try {
      const res = await removeClubLogo(clubId);
      if (res.error) {
        toast.error(res.error);
      } else {
        setLogoUrl(null);
        toast.success("Club logo removed");
      }
    } catch {
      toast.error("Failed to remove club logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBanner(true);
    try {
      const res = await updateClubBanner(clubId, file);
      if (res.error || !res.data) {
        toast.error(res.error ?? "Failed to upload banner image");
      } else {
        setBannerUrl(res.data);
        toast.success("Club banner updated");
      }
    } catch {
      toast.error("An unexpected error occurred while uploading the banner");
    } finally {
      setUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = "";
    }
  };

  const handleRemoveBanner = async () => {
    setUploadingBanner(true);
    try {
      const res = await removeClubBanner(clubId);
      if (res.error) {
        toast.error(res.error);
      } else {
        setBannerUrl(null);
        toast.success("Club banner removed");
      }
    } catch {
      toast.error("Failed to remove club banner");
    } finally {
      setUploadingBanner(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Camera className="h-4 w-4" />
            <span>Branding & Media</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Club Branding & Media</DialogTitle>
          <DialogDescription>
            Customize your club identity with an official crest and banner image.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Section: Club Logo */}
          <div className="rounded-xl border border-border/70 p-4 space-y-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold">Club Emblem / Logo</h4>
                <p className="text-xs text-muted-foreground">
                  Square crest or shield · PNG, JPG, WebP, SVG (max 2 MB)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <ClubLogo
                  name={clubName}
                  shortName={shortName}
                  logoUrl={logoUrl}
                  className="h-16 w-16 text-xl rounded-2xl"
                />
                {uploadingLogo && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/80">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleLogoUpload}
                  data-testid="club-logo-input"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="gap-1.5"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {logoUrl ? "Change Logo" : "Upload Logo"}
                </Button>
                {logoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveLogo}
                    disabled={uploadingLogo}
                    className="text-destructive hover:text-destructive gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Section: Club Banner */}
          <div className="rounded-xl border border-border/70 p-4 space-y-3 bg-muted/20">
            <div>
              <h4 className="text-sm font-semibold">Club Hero Banner</h4>
              <p className="text-xs text-muted-foreground">
                Wide landscape cover · PNG, JPG, or WebP (max 5 MB)
              </p>
            </div>

            <div className="relative h-28 w-full overflow-hidden rounded-xl border border-border/60 bg-muted flex items-center justify-center">
              {bannerUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bannerUrl}
                  alt={`${clubName} banner`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <ImageIcon className="h-8 w-8 opacity-40" />
                  <span className="text-xs">No banner set (default gradient used)</span>
                </div>
              )}

              {uploadingBanner && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleBannerUpload}
                data-testid="club-banner-input"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => bannerInputRef.current?.click()}
                disabled={uploadingBanner}
                className="gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                {bannerUrl ? "Change Banner" : "Upload Banner"}
              </Button>
              {bannerUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveBanner}
                  disabled={uploadingBanner}
                  className="text-destructive hover:text-destructive gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
