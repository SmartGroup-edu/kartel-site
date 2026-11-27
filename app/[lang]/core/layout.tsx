// bus 176 P1b: the cabinet's stylesheet loads here, not in the root [lang] layout, so the public crest home does not
// wait for it (app/crest-base.css carries the reset every page needs).
import "../../globals.css";

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
