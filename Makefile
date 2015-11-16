css/critical.css:
	phantomjs node_modules/penthouse/penthouse.js \
		http://localhost:1314 \
		css/main.css \
	> css/critical.css
	phantomjs node_modules/penthouse/penthouse.js \
		http://localhost:1314 \
		mdl/mdl-theme.css \
	>> css/critical.css
	./node_modules/clean-css/bin/cleancss < css/critical.css | sponge css/critical.css

build: css/critical.css
	npm run build
	sassc -lm sass/main.scss css/main.css
	scp index.html bundle.js staging:/var/www/art/
	scp css/main.css css/critical.css staging:/var/www/art/css/
