import { redirect } from "next/navigation";

/** Old link: the method now lives on the About page. */
export default function HowWeVerify() {
  redirect("/about");
}
