export function ShellStateScreen({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#121212] text-[#e5e5e5]">
      <div className="grid gap-2 text-center">
        <h1 className="m-0 text-3xl font-medium tracking-[-0.04em]">{title}</h1>
        {detail ? <p className="m-0 text-sm text-[#8f8f8f]">{detail}</p> : null}
      </div>
    </main>
  );
}
