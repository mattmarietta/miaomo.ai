import { redirect } from "next/navigation";

export default function Home() {
    // sends user directly to login
    redirect("/login");
}