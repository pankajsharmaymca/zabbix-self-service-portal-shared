package com.example.zabbixportal.config;

import java.net.ProxySelector;
import java.net.http.HttpClient;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;

import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLParameters;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class HttpClientConfig {

    private static final Logger log = LoggerFactory.getLogger(HttpClientConfig.class);

    @Bean
    RestClient zabbixRestClient(ZabbixProperties props) throws Exception {
        HttpClient.Builder builder = HttpClient.newBuilder()
                // Plain HTTP/1.1: no h2c upgrade attempts against Apache.
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(props.timeout())
                .proxy(ProxySelector.getDefault())
                .followRedirects(HttpClient.Redirect.NORMAL);

        if (props.caFile() != null && !props.insecureSsl()) {
            builder.sslContext(sslContextFor(props.caFile()));
            log.info("Trusting the CA certificate(s) in {} for the Zabbix API", props.caFile());
        }
        if (props.insecureSsl()) {
            log.warn("zabbix.insecure-ssl=true: TLS certificates of the Zabbix server are NOT verified");
            SSLContext ctx = SSLContext.getInstance("TLS");
            ctx.init(null, new TrustManager[] {new TrustAllManager()}, new SecureRandom());
            SSLParameters params = new SSLParameters();
            params.setEndpointIdentificationAlgorithm(null);
            builder.sslContext(ctx).sslParameters(params);
        }

        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(builder.build());
        factory.setReadTimeout(props.timeout());

        // Buffer the body so a Content-Length header is sent. Without it the request goes out
        // chunked, and Apache + PHP-FPM (mod_proxy_fcgi) hands PHP an empty body, which makes
        // Zabbix answer "Parse error: Invalid JSON".
        return RestClient.builder()
                .requestFactory(new BufferingClientHttpRequestFactory(factory))
                .baseUrl(props.url())
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    /** SSL context that trusts the CA certificate(s) in a PEM file. */
    private static SSLContext sslContextFor(String pemFile) throws Exception {
        java.security.KeyStore store = java.security.KeyStore.getInstance(java.security.KeyStore.getDefaultType());
        store.load(null, null);
        try (java.io.InputStream in = java.nio.file.Files.newInputStream(java.nio.file.Path.of(pemFile))) {
            int i = 0;
            for (java.security.cert.Certificate cert
                    : java.security.cert.CertificateFactory.getInstance("X.509").generateCertificates(in)) {
                store.setCertificateEntry("zabbix-ca-" + i++, cert);
            }
            if (i == 0) {
                throw new IllegalStateException("No certificates found in ZABBIX_CA_FILE " + pemFile);
            }
        }
        javax.net.ssl.TrustManagerFactory tmf =
                javax.net.ssl.TrustManagerFactory.getInstance(javax.net.ssl.TrustManagerFactory.getDefaultAlgorithm());
        tmf.init(store);
        SSLContext ctx = SSLContext.getInstance("TLS");
        ctx.init(null, tmf.getTrustManagers(), new SecureRandom());
        return ctx;
    }

    private static final class TrustAllManager implements X509TrustManager {
        @Override
        public void checkClientTrusted(X509Certificate[] chain, String authType) {
        }

        @Override
        public void checkServerTrusted(X509Certificate[] chain, String authType) {
        }

        @Override
        public X509Certificate[] getAcceptedIssuers() {
            return new X509Certificate[0];
        }
    }
}
