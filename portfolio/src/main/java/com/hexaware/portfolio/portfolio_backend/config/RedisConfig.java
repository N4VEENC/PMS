package com.hexaware.portfolio.portfolio_backend.config;

import java.time.Duration;
import java.util.List;

import org.springframework.cache.CacheManager;
import org.springframework.cache.Cache;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.JacksonJsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;

import com.hexaware.portfolio.benchmark.dto.BenchmarkComparisonResponse;
import com.hexaware.portfolio.benchmark.dto.BenchmarkResponse;
import com.hexaware.portfolio.portfolio_backend.dto.EligibleSecurityResponse;
import com.hexaware.portfolio.security.dto.SecurityMasterResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import tools.jackson.databind.ObjectMapper;

@Configuration
@EnableCaching
public class RedisConfig implements CachingConfigurer {
    private static final Logger logger = LoggerFactory.getLogger(RedisConfig.class);

    @Bean
    CacheManager benchmarkCacheManager(RedisConnectionFactory connectionFactory, ObjectMapper objectMapper) {
        RedisCacheConfiguration cacheDefaults = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(15))
                .disableCachingNullValues();

        var benchmarkListType = objectMapper.getTypeFactory()
                .constructCollectionType(List.class, BenchmarkResponse.class);
        var benchmarkListSerializer = new JacksonJsonRedisSerializer<Object>(objectMapper, benchmarkListType);
        var benchmarkResponseSerializer = new JacksonJsonRedisSerializer<Object>(
                objectMapper, objectMapper.getTypeFactory().constructType(BenchmarkResponse.class));
        var benchmarkPricesSerializer = new JacksonJsonRedisSerializer<Object>(
                objectMapper, objectMapper.getTypeFactory().constructType(BenchmarkComparisonResponse.class));
        var securityListType = objectMapper.getTypeFactory()
                .constructCollectionType(List.class, SecurityMasterResponse.class);
        var securityListSerializer = new JacksonJsonRedisSerializer<Object>(objectMapper, securityListType);
        var eligibleSecurityListType = objectMapper.getTypeFactory()
                .constructCollectionType(List.class, EligibleSecurityResponse.class);
        var eligibleSecurityListSerializer = new JacksonJsonRedisSerializer<Object>(objectMapper, eligibleSecurityListType);

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(cacheDefaults)
                .withCacheConfiguration("benchmark-list", cacheDefaults
                        .entryTtl(Duration.ofMinutes(30))
                        .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(benchmarkListSerializer)))
                .withCacheConfiguration("benchmark-detail", cacheDefaults
                        .entryTtl(Duration.ofMinutes(30))
                        .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(benchmarkResponseSerializer)))
                .withCacheConfiguration("benchmark-prices", cacheDefaults
                        .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(benchmarkPricesSerializer)))
                .withCacheConfiguration("security-master", cacheDefaults
                        .entryTtl(Duration.ofMinutes(5))
                        .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(securityListSerializer)))
                .withCacheConfiguration("eligible-securities", cacheDefaults
                        .entryTtl(Duration.ofMinutes(2))
                        .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(eligibleSecurityListSerializer)))
                .build();
    }

    @Bean
    CacheErrorHandler redisCacheErrorHandler() {
        return new CacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException exception, Cache cache, Object key) {
                logger.warn("Redis cache read failed for {}:{}; continuing without cache", cache.getName(), key, exception);
            }

            @Override
            public void handleCachePutError(RuntimeException exception, Cache cache, Object key, Object value) {
                logger.warn("Redis cache write failed for {}:{}; returning the database result", cache.getName(), key, exception);
            }

            @Override
            public void handleCacheEvictError(RuntimeException exception, Cache cache, Object key) {
                logger.warn("Redis cache eviction failed for {}:{}", cache.getName(), key, exception);
            }

            @Override
            public void handleCacheClearError(RuntimeException exception, Cache cache) {
                logger.warn("Redis cache clear failed for {}", cache.getName(), exception);
            }
        };
    }

    @Override
    public CacheErrorHandler errorHandler() {
        return redisCacheErrorHandler();
    }
}
