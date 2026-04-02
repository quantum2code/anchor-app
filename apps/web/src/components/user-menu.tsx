import { Button } from "@anchor/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@anchor/ui/components/dropdown-menu";
import { Skeleton } from "@anchor/ui/components/skeleton";
import { Link, useNavigate } from "@tanstack/react-router";

import { getAuthClient, useAuthSession } from "@/lib/auth-client";

export default function UserMenu() {
  const navigate = useNavigate();
  const { data: session, isPending } = useAuthSession();

  if (isPending) {
    return <Skeleton className="h-9 w-24" />;
  }

  if (!session) {
    return (
      <Link to="/login">
        <Button variant="outline">Sign In</Button>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        {session.user.name}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
            <DropdownMenuItem>{session.user.email}</DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={async () => {
                await getAuthClient().auth.signOut();
                navigate({
                  to: "/",
                });
              }}
            >
              Sign Out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
