vcl 4.1;

backend default {
    .host = "api.spotify.com";
    .port = "443";
}

sub vcl_recv {
    set req.http.host = "api.spotify.com";

    # Set cache key
    set req.http.cache_key = req.url;

    # Define cache expiration based on endpoint
    if (req.url ~ "^/v1/albums/") {
        set req.http.cache_lifetime = "30d";
    } else {
        # Default cache expiration for other endpoints
        set req.http.cache_lifetime = "1d";
    }

    return (hash);
}

sub vcl_backend_response {
    # Set cache expiration based on endpoint
    if (bereq.url ~ "^/v1/search") {
        set beresp.ttl = 1d;
    } else if (bereq.url ~ "^/v1/albums/") {
        set beresp.ttl = 15d;
    } else {
        # Default cache expiration for other endpoints
        set beresp.ttl = 2h;
    }

    # Allow stale cache for up to 5 minutes
    set beresp.grace = 5m;

    # Serve stale content while revalidating in the background
    set beresp.keep = 5m;

    # Do not cache error responses
    if (beresp.status >= 400) {
        set beresp.uncacheable = true;
        return (deliver);
    }

    return (deliver);
}

sub vcl_deliver {
    # Set cache control headers
    set resp.http.Cache-Control = "public, max-age=86400, s-maxage=86400";

    # Strip unwanted headers
    unset resp.http.Server;
    unset resp.http.X-Varnish;
}

sub vcl_backend_error {
    # Do not cache backend errors
    set beresp.uncacheable = true;
    return (retry);
}