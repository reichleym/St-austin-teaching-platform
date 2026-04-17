export function IconCard({
  title,
  blockContent = [],
  classNameCard = "",
  ...props
}: {
  title?: string;
  blockContent?: Array<{
    cardTitle: string;
    cardDescription: string;
    icon?: string;
  }>;
  classNameCard?: string;
  [key: string]: any;
}) {
  return (
    <section className="py-16 px-4 md:px-8">
      <div className="max-w-6xl mx-auto">
        {title && <h2 className="text-3xl font-bold mb-12 text-center">{title}</h2>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {blockContent.map((card, index) => (
            <div key={index} className={classNameCard || "bg-white rounded-lg p-6 shadow-md"}>
              {card.icon && (
                <div className="mb-4 h-16 w-16">
                  <img
                    src={card.icon}
                    alt={card.cardTitle}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              <h3 className="text-lg font-bold mb-2">{card.cardTitle}</h3>
              <p className="text-gray-600">{card.cardDescription}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
