export function BannerSection({
  title,
  description,
  bgImg,
  ...props
}: {
  title?: string;
  description?: string;
  bgImg?: string;
  [key: string]: any;
}) {
  return (
    <section
      className="py-16 px-4 md:px-8 text-white text-center"
      style={
        bgImg
          ? {
              backgroundImage: `url(${bgImg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : { backgroundColor: "#2c3e50" }
      }
    >
      <div className="max-w-4xl mx-auto py-8">
        <h1 className="text-4xl font-bold mb-4 drop-shadow-lg">{title}</h1>
        {description && (
          <p className="text-xl drop-shadow-lg">{description}</p>
        )}
      </div>
    </section>
  );
}
