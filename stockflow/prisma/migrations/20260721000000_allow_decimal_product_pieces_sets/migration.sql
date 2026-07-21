ALTER TABLE "Product"
ALTER COLUMN "piecesSets" TYPE DOUBLE PRECISION
USING "piecesSets"::double precision;
