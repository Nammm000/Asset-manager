package tech.getarrays.assetmanager.services.asset;

import com.google.common.hash.BloomFilter;
import com.google.common.hash.Funnels;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import tech.getarrays.assetmanager.repo.SavingsPassbookRepo;

import java.util.List;

/**
 * In-memory Guava Bloom filters guarding both passbook read paths against cache
 * penetration: a Redis miss for data that has never existed never reaches Postgres.
 *
 * <p>Fail-open by design, mirroring RedisCacheConfig's degrade-to-DB error handler:
 * until the startup rebuild succeeds, every mightContain* answers {@code true}, so an
 * unbuilt or failed filter can never claim "definitely absent" for real data.
 *
 * <p>Never removes on delete: a stale bit is a false <em>positive</em> (costs one DB
 * hit), never a false negative. {@link #rebuild()} PUTs into the existing filter
 * instances instead of swapping them, so adds racing the startup load are never lost —
 * the web server accepts requests before ApplicationRunners execute.
 */
@Slf4j
@Component
public class SavingsPassbookBloomFilter implements ApplicationRunner {

    private final SavingsPassbookRepo savingsPassbookRepo;
    private final BloomFilter<Long> passbookIds;   // ids of every passbook that ever existed
    private final BloomFilter<Long> ownerUserIds;  // user ids owning >= 1 passbook
    private volatile boolean ready = false;

    @Autowired
    public SavingsPassbookBloomFilter(
            SavingsPassbookRepo theSavingsPassbookRepo,
            @Value("${app.cache.bloom.expected-insertions:100000}") int expectedInsertions,
            @Value("${app.cache.bloom.fpp:0.01}") double fpp) {
        savingsPassbookRepo = theSavingsPassbookRepo;
        passbookIds = BloomFilter.create(Funnels.longFunnel(), expectedInsertions, fpp);
        ownerUserIds = BloomFilter.create(Funnels.longFunnel(), expectedInsertions, fpp);
    }

    @Override
    public void run(ApplicationArguments args) {
        rebuild();
    }

    /** Loads both filters from the DB; on any failure stays/returns to pass-through mode. */
    void rebuild() {
        try {
            List<Long> ids = savingsPassbookRepo.findAllPassbookIds();
            ids.forEach(passbookIds::put);
            List<Long> owners = savingsPassbookRepo.findDistinctOwnerUserIds();
            owners.forEach(ownerUserIds::put);
            ready = true;
            log.info("Bloom filters loaded: {} passbook ids, {} owner user ids", ids.size(), owners.size());
        } catch (Exception e) {
            ready = false;
            log.warn("Bloom filter rebuild failed - pass-through mode, every check degrades to the DB: {}",
                    e.getMessage());
        }
    }

    /** False only when loaded AND the id is definitely not a passbook. */
    public boolean mightContainPassbook(long id) {
        return !ready || passbookIds.mightContain(id);
    }

    /** False only when loaded AND the user definitely owns no passbook. */
    public boolean mightHavePassbooks(long userId) {
        return !ready || ownerUserIds.mightContain(userId);
    }

    public void addPassbook(long id) {
        passbookIds.put(id);
    }

    public void addUserWithPassbook(long userId) {
        ownerUserIds.put(userId);
    }

    /** Visible for tests. */
    boolean isReady() {
        return ready;
    }
}
