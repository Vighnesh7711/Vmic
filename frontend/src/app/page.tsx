import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-6 text-white">
      <div className="w-full max-w-xl text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-green-500/10 border border-green-500/30 text-4xl shadow-lg shadow-green-500/10">
            🎙️
          </div>
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          VMIC <span className="text-green-400">Audio System</span>
        </h1>
        
        <p className="mt-4 text-lg text-gray-400">
          Virtual Classroom Wireless Microphone & Audio PA System over Wi-Fi
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/host/create"
            className="flex items-center justify-center gap-2 rounded-xl bg-green-500 px-8 py-4 font-bold text-black shadow-lg transition hover:bg-green-400 hover:scale-105"
          >
            <span>👑 Host / Create Session</span>
          </Link>
          <Link
            href="/join"
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-900 px-8 py-4 font-bold text-white shadow-lg transition hover:border-gray-500 hover:bg-gray-800 hover:scale-105"
          >
            <span>📱 Participant / Join Session</span>
          </Link>
        </div>

        <div className="mt-12 rounded-xl border border-gray-800 bg-gray-900/60 p-5 text-left text-sm text-gray-400">
          <h3 className="font-semibold text-gray-300">Quick Instructions:</h3>
          <ul className="mt-2 space-y-1 list-disc list-inside text-gray-400">
            <li><strong>Host Laptop:</strong> Click <span className="text-green-400 font-medium">Host / Create Session</span> to set up classroom audio routing.</li>
            <li><strong>Mobile Phones:</strong> Click <span className="text-white font-medium">Participant / Join</span> or scan host QR code.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}

