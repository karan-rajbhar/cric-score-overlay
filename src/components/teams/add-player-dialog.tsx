"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Search, UserPlus, Loader2, Check } from "lucide-react";
import { searchUsers, addPlayerToTeam } from "~/app/teams/actions";
import { toast } from "sonner";
import { cn } from "~/lib/utils";

interface AddPlayerDialogProps {
  teamId: string;
  onSuccess?: () => void;
}

export function AddPlayerDialog({ teamId, onSuccess }: AddPlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [users, setUsers] = useState<
    { id: string; email: string; full_name?: string }[]
  >([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.length < 2) return;

    setSearching(true);
    setUsers([]);
    setSelectedUser(null);

    try {
      const { data, error } = await searchUsers(query);
      if (error) {
        toast.error("Search failed");
      } else {
        setUsers(data || []);
      }
    } catch {
      toast.error("Failed to search users");
    } finally {
      setSearching(false);
    }
  };

  const handleAddPlayer = async () => {
    if (!selectedUser) return;

    setAdding(true);
    try {
      const result = await addPlayerToTeam(teamId, selectedUser);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Player added successfully");
        setOpen(false);
        setQuery("");
        setUsers([]);
        setSelectedUser(null);
        if (onSuccess) onSuccess();
      }
    } catch {
      toast.error("Failed to add player");
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Player
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Player to Squad</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              placeholder="Search by name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={searching || query.length < 2}>
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </form>

          <div className="max-h-[300px] space-y-2 overflow-y-auto">
            {users.length > 0 ? (
              users.map((user) => (
                <div
                  key={user.id}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-md border p-3 transition-colors hover:bg-muted",
                    selectedUser === user.id &&
                      "border-primary bg-primary/5 ring-1 ring-primary",
                  )}
                  onClick={() => setSelectedUser(user.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                      {user.full_name?.substring(0, 1)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{user.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  {selectedUser === user.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
              ))
            ) : query.length >= 2 && !searching && users.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No users found
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={adding}
          >
            Cancel
          </Button>
          <Button onClick={handleAddPlayer} disabled={!selectedUser || adding}>
            {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
