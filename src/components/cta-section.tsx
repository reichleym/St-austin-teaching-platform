export function CtaSection({
  title,
  desc,
  buttons = [],
  className = "",
  ...props
}: {
  title?: string;
  desc?: string;
  buttons?: string[];
  className?: string;
  [key: string]: any;
}) {
  return (
    <section
      className={`py-16 px-4 md:px-8 bg-gradient-to-r from-blue-600 to-indigo-600 text-white ${className}`}
    >
      <div className="max-w-4xl mx-auto text-center">
        {title && <h2 className="text-4xl font-bold mb-4">{title}</h2>}
        {desc && <p className="text-xl mb-8 text-blue-50">{desc}</p>}
        {buttons.length > 0 && (
          <div className="flex flex-wrap gap-4 justify-center">
            {buttons.map((button, index) => (
              <button
                key={index}
                className={`px-6 py-3 rounded font-semibold transition ${
                  index === 0
                    ? "bg-white text-blue-600 hover:bg-blue-50"
                    : "bg-blue-500 text-white hover:bg-blue-700 border border-white"
                }`}
              >
                {button}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
