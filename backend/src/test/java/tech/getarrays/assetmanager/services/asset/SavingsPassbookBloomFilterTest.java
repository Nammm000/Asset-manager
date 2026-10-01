package tech.getarrays.assetmanager.services.asset;

import org.junit.jupiter.api.Test;
import tech.getarrays.assetmanager.repo.SavingsPassbookRepo;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

class SavingsPassbookBloomFilterTest {

    @Test
    void unbuiltFilterPassesEverythingThrough() {
        SavingsPassbookBloomFilter filter = new SavingsPassbookBloomFilter(null, 1000, 0.01);

        assertThat(filter.isReady()).isFalse();
        assertThat(filter.mightContainPassbook(42L)).isTrue();
        assertThat(filter.mightHavePassbooks(42L)).isTrue();
    }

    @Test
    void rebuildLoadsIdsAndOwnersFromRepo() {
        SavingsPassbookBloomFilter filter = new SavingsPassbookBloomFilter(
                repoReturning(List.of(1L, 2L), List.of(7L)), 100_000, 1e-6);
        filter.rebuild();

        assertThat(filter.isReady()).isTrue();
        assertThat(filter.mightContainPassbook(1L)).isTrue();
        assertThat(filter.mightContainPassbook(2L)).isTrue();
        assertThat(filter.mightHavePassbooks(7L)).isTrue();
        // fpp 1e-6 keeps the negative assertions from flaking
        assertThat(filter.mightContainPassbook(987_654_321L)).isFalse();
        assertThat(filter.mightHavePassbooks(987_654_321L)).isFalse();
    }

    @Test
    void failedRebuildStaysPassThrough() {
        SavingsPassbookBloomFilter filter = new SavingsPassbookBloomFilter(
                repoThrowing(), 1000, 0.01);

        assertThatCode(filter::rebuild).doesNotThrowAnyException();
        assertThat(filter.isReady()).isFalse();
        assertThat(filter.mightContainPassbook(1L)).isTrue();
        assertThat(filter.mightHavePassbooks(1L)).isTrue();
    }

    @Test
    void failedRebuildAfterPartialLoadStaysPassThrough() {
        SavingsPassbookRepo repo = repoWithHandler((proxy, method, args) -> switch (method.getName()) {
            case "findAllPassbookIds" -> List.of(1L, 2L, 3L);
            case "findDistinctOwnerUserIds" -> throw new RuntimeException("owner query failed");
            default -> throw new UnsupportedOperationException(method.getName());
        });
        SavingsPassbookBloomFilter filter = new SavingsPassbookBloomFilter(repo, 1000, 0.01);

        assertThatCode(filter::rebuild).doesNotThrowAnyException();
        assertThat(filter.isReady()).isFalse();
        // the passbook-id filter is partially populated, but ready gates BOTH checks
        assertThat(filter.mightContainPassbook(1L)).isTrue();
        assertThat(filter.mightHavePassbooks(1L)).isTrue();
    }

    @Test
    void addWorksWithoutRebuild() {
        SavingsPassbookBloomFilter filter = new SavingsPassbookBloomFilter(null, 1000, 0.01);

        filter.addPassbook(9L);
        filter.addUserWithPassbook(9L);

        assertThat(filter.mightContainPassbook(9L)).isTrue();
        assertThat(filter.mightHavePassbooks(9L)).isTrue();
    }

    private static SavingsPassbookRepo repoReturning(List<Long> passbookIds, List<Long> ownerUserIds) {
        return repoWithHandler((proxy, method, args) -> switch (method.getName()) {
            case "findAllPassbookIds" -> passbookIds;
            case "findDistinctOwnerUserIds" -> ownerUserIds;
            default -> throw new UnsupportedOperationException(method.getName());
        });
    }

    private static SavingsPassbookRepo repoThrowing() {
        return repoWithHandler((proxy, method, args) -> {
            throw new RuntimeException("boom from " + method.getName());
        });
    }

    private static SavingsPassbookRepo repoWithHandler(InvocationHandler handler) {
        return (SavingsPassbookRepo) Proxy.newProxyInstance(
                SavingsPassbookRepo.class.getClassLoader(), new Class<?>[]{SavingsPassbookRepo.class}, handler);
    }
}
