import { Header } from "@/components/Header";
import { CreateSessionForm } from "@/components/CreateSessionForm";

export default function CreateSessionPage() {
  return (
    <>
      <Header hostName="Host" roomId="Offline" sessionStatus="CONFIG" />
      <main className="w-full pt-[112px] bg-surface min-h-screen">
        <div className="flex flex-col w-full px-md pb-xl">
          <CreateSessionForm />
        </div>
      </main>
    </>
  );
}
